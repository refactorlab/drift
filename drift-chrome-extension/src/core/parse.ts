// Parse the Andy/Drift sticky comment out of a rendered GitHub PR page.
//
// GitHub strips HTML comments from rendered markdown, so the `<!-- drift:
// sticky-comment -->` marker is NOT in the DOM. Instead we rely on the
// renderer's deterministic badge + gauge `alt` text, which is stable output
// from `action/src/render/`. This module is pure-DOM and side-effect free so
// it can be unit-tested against a snapshot of comment HTML.

import {
  emptyReport,
  type ArtifactRef,
  type AudioRef,
  type DriftReport,
  type Direction,
  type Gauge,
  type Metric,
  type MetricLevel,
  type MetricSection,
  type PrContext,
  type PrIdentity,
  type Verdict,
} from './types';

const GAUGE_TONES: Record<string, Gauge['tone']> = {
  'merge-confidence': 'bad',
  'review-effort': 'warn',
  risks: 'bad',
  drift: 'info',
  suggestions: 'info',
  'new-tests': 'warn',
};

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function levelFromLabel(label: string): MetricLevel {
  const l = label.toUpperCase();
  if (l.includes('CRITICAL')) return 'critical';
  if (l.includes('MODERATE')) return 'moderate';
  if (l.includes('LOW')) return 'low';
  return 'unknown';
}

function directionFrom(text: string): Direction {
  if (text.includes('↑')) return 'up';
  if (text.includes('↓')) return 'down';
  return 'none';
}

function firstPercent(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

/** Normalize the headline gauge value into a 0..1 dial fraction. */
function gaugeFraction(key: string, display: string): number | null {
  const ratio = display.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (ratio) {
    const den = Number(ratio[2]);
    return den ? Number(ratio[1]) / den : null;
  }
  if (key === 'drift') {
    // signed percentage, e.g. "−5.5%" — map |x| onto 0..1 clamped at 100%.
    const m = display.match(/(-?\d+(?:\.\d+)?)/);
    if (m) return Math.min(1, Math.abs(Number(m[1].replace('−', '-'))) / 100);
  }
  // Raw counts (risks, suggestions, new tests) have no natural denominator.
  return null;
}

function verdictFrom(label: string): Verdict {
  const l = label.toLowerCase();
  if (l.includes('address')) return 'address';
  if (l.includes('approve') || l.includes('ship') || l.includes('good to merge'))
    return 'approve';
  if (l.includes('review')) return 'review';
  return 'unknown';
}

/**
 * Find the comment element that is the Drift report. Strategy: the report
 * always contains a headline gauge image whose alt starts with one of the
 * known gauge labels. We pick the nearest comment container.
 */
export function findReportRoot(doc: Document = document): HTMLElement | null {
  const gauge = Array.from(doc.querySelectorAll<HTMLImageElement>('img[alt]')).find(
    (img) => gaugeParts(img.alt) !== null,
  );
  if (!gauge) return null;
  // On a real GitHub PR the report sits inside a comment body — scope to it so
  // we never bleed into a neighbouring comment.
  const scoped = gauge.closest<HTMLElement>(
    '.comment-body, .js-comment-body, .markdown-body, [class*="IssueComment"], .timeline-comment',
  );
  if (scoped) return scoped;
  // No comment wrapper (raw-rendered markdown, non-GitHub hosts, tests): scope
  // to the whole document. The gauge/heading patterns are specific enough that
  // widening here is safe, and the .comment-body path above keeps the live
  // GitHub case tightly scoped to a single comment.
  return gauge.ownerDocument.body ?? gauge.parentElement;
}

const GAUGE_LABEL = /^(MERGE CONFIDENCE|REVIEW EFFORT|RISKS|DRIFT|SUGGESTIONS|NEW TESTS)\b/i;
// A real gauge value starts with a digit or sign (e.g. "0/5", "7", "−5.5%").
// This guards against label collisions like the "Drift review" logo alt.
const GAUGE_VALUE = /^[−+\-]?\d/;

/** True only for alts that are an actual headline gauge ("LABEL value"). */
function gaugeParts(alt: string): { label: string; display: string } | null {
  const trimmed = alt.trim();
  const m = trimmed.match(GAUGE_LABEL);
  if (!m) return null;
  const display = trimmed.slice(m[1].length).trim();
  if (!GAUGE_VALUE.test(display)) return null;
  return { label: m[1].trim().toUpperCase(), display };
}

export function parseGauges(root: ParentNode): Gauge[] {
  const seen = new Set<string>();
  const gauges: Gauge[] = [];
  for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img[alt]'))) {
    const parts = gaugeParts(img.alt);
    if (!parts) continue;
    const { label, display } = parts;
    const key = slug(label);
    if (seen.has(key)) continue;
    seen.add(key);
    gauges.push({
      key,
      label,
      display,
      fraction: gaugeFraction(key, display),
      tone: GAUGE_TONES[key] ?? 'info',
    });
  }
  return gauges;
}

/**
 * Parse the Complexity & Risk Report sections. The renderer emits
 * `### N. Title` headings (h3) and `#### Metric ![LEVEL pct%](...)` (h4 with an
 * inline badge img). We read the h4 text for the name and the badge alt for the
 * level / percent / direction.
 */
export function parseSections(root: ParentNode): MetricSection[] {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h3, h4'));
  const sections: MetricSection[] = [];
  let current: MetricSection | null = null;

  for (const h of headings) {
    if (h.tagName === 'H3') {
      const text = (h.textContent ?? '').trim();
      const m = text.match(/^(\d+)\.\s*(.+)$/);
      if (!m) continue; // skip non-report h3s (GitHub adds its own)
      current = { index: Number(m[1]), title: m[2].trim(), metrics: [] };
      sections.push(current);
      continue;
    }
    // H4 — a metric row.
    if (!current) continue;
    const badge = h.querySelector<HTMLImageElement>('img[alt]');
    // Metric name is the heading text minus the badge alt fragment.
    const name = (h.textContent ?? '').replace(/\s+/g, ' ').trim();
    const altText = badge?.alt?.trim() ?? '';
    if (!name) continue;
    const cleanName = name.replace(new RegExp(`\\s*${escapeRe(altText)}\\s*$`), '').trim() || name;
    // The trend arrow (↑/↓) lives in the shields badge URL (e.g. %E2%86%91),
    // not in the markdown alt text, so fold the decoded src into the search.
    const metric: Metric = {
      name: cleanName,
      level: levelFromLabel(altText),
      percent: firstPercent(altText),
      direction: directionFrom(`${altText} ${decodeUri(badge?.getAttribute('src'))}`),
    };
    current.metrics.push(metric);
  }
  return sections.filter((s) => s.metrics.length > 0);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Decode a URL so percent-encoded arrows (%E2%86%91) become ↑/↓; never throws. */
function decodeUri(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** Read the verdict + merge-confidence + effort banner badges. */
function parseBanner(root: ParentNode): {
  verdictLabel: string;
  effortLabel: string | null;
  mergeConfidence: DriftReport['mergeConfidence'];
} {
  const alts = Array.from(root.querySelectorAll<HTMLImageElement>('img[alt]')).map((i) =>
    i.alt.trim(),
  );
  const verdictLabel =
    alts.find((a) => /address before merge|good to merge|review recommended|ship/i.test(a))?.replace(/^[^\w]+/, '') ??
    '';
  const effortLabel = alts.find((a) => /\b(min\+?\s*review|review)\b.*risk|risk.*review/i.test(a)) ?? alts.find((a) => /min\+?\s*review/i.test(a)) ?? null;
  let mergeConfidence: DriftReport['mergeConfidence'] = null;
  const mc = alts.find((a) => /merge confidence\s+\d+\s*\/\s*\d+/i.test(a));
  if (mc) {
    const m = mc.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) mergeConfidence = { value: Number(m[1]), outOf: Number(m[2]) };
  }
  return { verdictLabel, effortLabel, mergeConfidence };
}

/** Parse "Blast radius 100 · 4 critical · 18 metrics" from the summary line. */
function parseSummaryLine(root: ParentNode): {
  blastRadius: number | null;
  criticalCount: number | null;
  metricCount: number | null;
} {
  const text = (root.textContent ?? '').replace(/\s+/g, ' ');
  const blast = text.match(/blast radius\s+(\d+)/i);
  const crit = text.match(/(\d+)\s+critical/i);
  const metrics = text.match(/(\d+)\s+metrics/i);
  return {
    blastRadius: blast ? Number(blast[1]) : null,
    criticalCount: crit ? Number(crit[1]) : null,
    metricCount: metrics ? Number(metrics[1]) : null,
  };
}

/** Top-level entry: scrape the active document into a DriftReport. */
export function parseReport(doc: Document = document): DriftReport {
  const root = findReportRoot(doc);
  if (!root) return emptyReport();

  const banner = parseBanner(root);
  const gauges = parseGauges(root);
  const sections = parseSections(root);
  const summary = parseSummaryLine(root);

  // Prefer the merge-confidence gauge value if the banner badge was absent.
  let mergeConfidence = banner.mergeConfidence;
  if (!mergeConfidence) {
    const g = gauges.find((x) => x.key === 'merge-confidence');
    const m = g?.display.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) mergeConfidence = { value: Number(m[1]), outOf: Number(m[2]) };
  }

  return {
    found: true,
    verdict: verdictFrom(banner.verdictLabel),
    verdictLabel: banner.verdictLabel,
    effortLabel: banner.effortLabel,
    mergeConfidence,
    gauges,
    blastRadius: summary.blastRadius,
    criticalCount: summary.criticalCount,
    metricCount: summary.metricCount,
    sections,
    prUrl: canonicalPrUrl(doc),
    scrapedAt: epochMs(),
  };
}

function canonicalPrUrl(doc: Document): string | null {
  const loc = doc.defaultView?.location;
  if (!loc) return null;
  const m = loc.pathname.match(/^\/[^/]+\/[^/]+\/pull\/\d+/);
  return m ? `${loc.origin}${m[0]}` : null;
}

// Avoid Date.now() at module scope for testability; callers can override.
function epochMs(): number {
  return typeof Date !== 'undefined' ? new Date().valueOf() : 0;
}

export function isPrPage(loc: Location = location): boolean {
  return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(loc.pathname);
}

// ── Scan artifacts + PR identity ─────────────────────────────────────────────

function classifyArtifact(name: string): ArtifactRef['kind'] {
  if (/pr-scan-context\.json$/i.test(name)) return 'scan-context';
  if (/pr-scan\.json$/i.test(name)) return 'scan-report';
  return 'other';
}

/**
 * Parse the collapsed "📎 Scan artifacts (JSON)" accordion the action renders at
 * the bottom of the comment. We find the <details> whose <summary> mentions
 * "Scan artifacts" and read its <a> links (pr-scan.json / pr-scan-context.json).
 * These are GitHub Actions artifact URLs — zipped and download-gated by login.
 */
export function parseScanArtifacts(root: ParentNode): ArtifactRef[] {
  const summaries = Array.from(root.querySelectorAll<HTMLElement>('summary'));
  const summary = summaries.find((s) => /scan artifacts/i.test(s.textContent ?? ''));
  const details = summary?.closest('details') ?? null;
  if (!details) return []; // no accordion → nothing to attach (don't guess at stray .json links)
  const out: ArtifactRef[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(details.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const name = (a.textContent ?? '').trim();
    const url = a.getAttribute('href') ?? '';
    if (!/\.json$/i.test(name) || !url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ name, url, kind: classifyArtifact(name) });
  }
  return out;
}

// The action renders the audio link as `<a href=…artifacts/N><img alt="🔊
// Listen to the spoken summary (Kokoro TTS)"></a>`. Match on the alt text (the
// speaker glyph / "spoken summary" / engine name) so we don't depend on the
// exact wording — and keep the legacy "piper tts" alternative so audio links
// in older PR comments still resolve. Only accept a GitHub Actions artifact href.
const AUDIO_ALT = /spoken summary|listen to the spoken|kokoro tts|piper tts|🔊/i;
const ARTIFACT_HREF = /\/actions\/runs\/\d+\/artifacts\/\d+/i;

/** Find the spoken-summary audio artifact link inside the Drift comment. */
export function parseAudioSummary(root: ParentNode): AudioRef | null {
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const url = a.getAttribute('href') ?? '';
    if (!ARTIFACT_HREF.test(url)) continue;
    const img = a.querySelector<HTMLImageElement>('img[alt]');
    const label = (img?.alt ?? a.textContent ?? '').trim();
    if (!AUDIO_ALT.test(label)) continue;
    return { url, label: label || '🔊 Listen to the spoken summary' };
  }
  return null;
}

/** Derive owner/repo/number/title from the PR page. */
export function parsePrIdentity(doc: Document = document): PrIdentity | null {
  const loc = doc.defaultView?.location;
  if (!loc) return null;
  const m = loc.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return null;
  // GitHub renders the PR title in .js-issue-title (with an Andy fallback to <title>).
  const titleEl = doc.querySelector<HTMLElement>('.js-issue-title, .gh-header-title .markdown-title');
  const title =
    titleEl?.textContent?.trim() ||
    doc.title.replace(/\s*·.*$/, '').trim() ||
    null;
  return {
    owner: m[1],
    repo: m[2],
    number: Number(m[3]),
    title,
    url: `${loc.origin}/${m[1]}/${m[2]}/pull/${m[3]}`,
  };
}

/**
 * Assemble the full PR context for the chat: the parsed Drift report plus any
 * linked scan artifacts. Returns null when there's no Drift report on the page.
 */
export function parsePrContext(doc: Document = document): PrContext | null {
  const root = findReportRoot(doc);
  const pr = parsePrIdentity(doc);
  if (!root || !pr) return null;
  const audio = parseAudioSummary(root);
  return {
    pr,
    report: parseReport(doc),
    artifacts: contextFiles(parseScanArtifacts(root)),
    ...(audio ? { audio } : {}),
    detectedAt: epochMs(),
  };
}

/**
 * The two canonical context files always exist for a Drift PR — `pr-scan.json`
 * (the report) and `pr-scan-context.json` (PR identity + scope). We attach the
 * real GitHub download URL when the comment linked one; otherwise the file is
 * reconstructed locally from the parsed report. This is why files show up even
 * on PRs whose comment didn't upload artifacts.
 */
export function contextFiles(detected: ArtifactRef[]): ArtifactRef[] {
  const urlFor = (kind: ArtifactRef['kind']) => detected.find((a) => a.kind === kind)?.url;
  return [
    { name: 'pr-scan.json', kind: 'scan-report', url: urlFor('scan-report') },
    { name: 'pr-scan-context.json', kind: 'scan-context', url: urlFor('scan-context') },
  ];
}
