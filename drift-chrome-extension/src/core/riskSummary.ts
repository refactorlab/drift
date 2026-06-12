// Top-3 risk summary for the live-scan dashboard. Two paths, same shape out:
//
//  • deriveTopRisks()  — PURE, on-device. Reads the risks the scanner already
//    produced (visual_summary.risks → code_suggestions → critical metrics) and
//    ranks the worst three. Always available, no network, no AI. This is the
//    instant first paint and the offline fallback.
//
//  • summarizeRisksWithBrain() — asks the local drift-brain (Claude via your
//    `claude login`, the only ToS-legal subscription path) to read the same scan
//    and write three crisp one-liners. Streams a one-shot /turn and parses the
//    numbered lines. Fail-soft: returns null on any error (brain offline, parse
//    miss) so the caller keeps the on-device list.
//
// Kept free of React so the ranking + prompt + parsing all unit-test in plain node.

import type { DriftReport } from './types';
import { asScanOutput, type ScanOutput, type RiskItem, type CodeSuggestion } from './scanOutput';
import { streamBrain, DEFAULT_BRAIN_URL, DEFAULT_VOICE_MODEL } from './voiceBrain';

export type RiskSeverity = 'high' | 'moderate' | 'low';

export interface TopRisk {
  /** 1-based rank, most important first. */
  rank: number;
  /** The one-line risk statement shown to the user. */
  text: string;
  /** File the risk is anchored to, when known (scanner suggestions carry one). */
  file?: string;
  severity?: RiskSeverity;
}

/** Where a rendered TopRisk[] came from — drives the card's badge. */
export type RiskSource = 'scan' | 'claude';

const sevBucket = (v: number): RiskSeverity => (v >= 0.66 ? 'high' : v >= 0.33 ? 'moderate' : 'low');

// act_before_merge is the scanner's "do something now" quadrant — always rank it
// above the rest regardless of the raw severity·likelihood product.
const QUADRANT_WEIGHT: Record<NonNullable<RiskItem['quadrant']>, number> = {
  act_before_merge: 3,
  monitor_closely: 2,
  document_and_ship: 1,
  acceptable: 0,
};

const round2 = (n: number): number => (typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : n);
// Coerce a possibly-missing/garbage numeric field (the scan is `unknown`) to a
// finite number so a malformed item can't poison a ranking sort with NaN.
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

function firstLine(s: string, max = 140): string {
  const line = s.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function fromRiskItems(items: RiskItem[]): TopRisk[] {
  return items
    .filter((r) => r.label?.trim())
    .map((r) => ({
      r,
      score: (QUADRANT_WEIGHT[r.quadrant ?? 'acceptable'] ?? 0) * 10 + num(r.likelihood) * num(r.severity),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ r }, i) => ({ rank: i + 1, text: firstLine(r.label), severity: sevBucket(num(r.severity)) }));
}

function fromSuggestions(suggestions: CodeSuggestion[]): TopRisk[] {
  const sevRank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  return suggestions
    .filter((s) => s.severity === 'critical' || s.severity === 'high')
    .sort((a, b) => (sevRank[b.severity ?? ''] ?? 0) - (sevRank[a.severity ?? ''] ?? 0) || num(b.confidence) - num(a.confidence))
    .slice(0, 3)
    .map((s, i) => ({
      rank: i + 1,
      text: firstLine(s.summary || s.why_it_matters || s.rule_id || 'Flagged code change'),
      file: s.file,
      // We only kept critical/high suggestions, so they all read as "high".
      severity: 'high' as const,
    }));
}

function fromCriticalMetrics(report: DriftReport): TopRisk[] {
  return report.sections
    .flatMap((sec) => sec.metrics)
    .filter((m) => m.level === 'critical')
    .slice(0, 3)
    .map((m, i) => ({ rank: i + 1, text: `${m.name} is at a critical level`, severity: 'high' as const }));
}

/**
 * Rank the three most important risks from what the scanner already produced.
 * Tries structured risk items first, then high/critical code suggestions, then
 * critical metrics. Returns [] when the scan flags nothing notable (a clean PR).
 */
export function deriveTopRisks(scan: unknown, report: DriftReport): TopRisk[] {
  const out = asScanOutput(scan);
  const items = out?.pr_review?.visual_summary?.risks?.items;
  if (items?.length) {
    const ranked = fromRiskItems(items);
    if (ranked.length) return ranked;
  }
  const suggestions = out?.pr_review?.code_suggestions;
  if (suggestions?.length) {
    const ranked = fromSuggestions(suggestions);
    if (ranked.length) return ranked;
  }
  return fromCriticalMetrics(report);
}

// ─── Claude path (local drift-brain) ────────────────────────────────────────

export const RISK_SYSTEM_PROMPT =
  'You are a precise senior code reviewer. You will be given a JSON summary of a ' +
  'pull-request scan (verdict, drift, structured risks, high-severity code ' +
  'suggestions, and critical metrics). Identify the THREE most important risks a ' +
  'reviewer must weigh before merging — concrete, specific, and ranked most ' +
  'important first.\n\n' +
  'Output EXACTLY three lines and nothing else. Each line: a number, a period, a ' +
  'space, then ONE plain-English sentence (no markdown, no bold, no file paths in ' +
  'parentheses unless essential, max ~18 words). If the scan shows no real risk, ' +
  'still return the three least-confident areas to double-check.';

/** Build the compact JSON grounding the brain reasons over. Pure → testable. */
export function buildRiskUserContent(scan: unknown, report: DriftReport): string {
  const out: ScanOutput | null = asScanOutput(scan);
  const review = out?.pr_review;
  const ext = out?.pr_review_ext;
  const ctx = {
    verdict: report.verdictLabel || report.verdict,
    drift: review?.overall_drift
      ? `${review.overall_drift.direction} ${review.overall_drift.percent}%`
      : undefined,
    merge_confidence: report.mergeConfidence
      ? `${report.mergeConfidence.value}/${report.mergeConfidence.outOf}`
      : undefined,
    changed_files: out?.pr_scope?.changed_files?.slice(0, 25),
    risks: review?.visual_summary?.risks?.items?.slice(0, 8).map((r) => ({
      label: r.label,
      quadrant: r.quadrant,
      likelihood: round2(r.likelihood),
      severity: round2(r.severity),
    })),
    high_severity_suggestions: review?.code_suggestions
      ?.filter((s) => s.severity === 'critical' || s.severity === 'high')
      .slice(0, 8)
      .map((s) => ({ file: s.file, severity: s.severity, why: firstLine(s.why_it_matters, 160) })),
    critical_metrics: report.sections
      .flatMap((sec) => sec.metrics)
      .filter((m) => m.level === 'critical')
      .map((m) => m.name),
    reliability_gaps: ext?.nfr_edge_cases?.reliability_gaps?.slice(0, 6),
    uncovered_roots: ext?.tests_in_graph?.uncovered_roots?.slice(0, 6),
  };
  // JSON.stringify already omits undefined-valued properties, so the optional
  // fields above simply drop out of the payload when the scan didn't carry them.
  return JSON.stringify(ctx);
}

/** Parse the brain's three numbered lines into TopRisk[]. Pure → testable. */
export function parseRiskLines(text: string): TopRisk[] {
  const risks: TopRisk[] = [];
  for (const raw of text.split('\n')) {
    // Strip any leading whitespace / bullet / bold-emphasis the model prepends
    // despite the "no markdown" instruction (e.g. `**1. …**`, `- 1. …`, `* 1. …`)
    // BEFORE matching the number, so a bold-wrapped list isn't silently dropped.
    const line = raw.replace(/^[\s>*+-]+/, '');
    const m = line.match(/^(\d+)[.)]\s*(.+?)\s*$/);
    const body = m ? m[2] : '';
    if (!body) continue;
    // Strip stray markdown emphasis the model may add despite instructions.
    const clean = body.replace(/\*\*/g, '').replace(/^[-*]\s*/, '').trim();
    if (clean) risks.push({ rank: risks.length + 1, text: firstLine(clean) });
    if (risks.length === 3) break;
  }
  return risks;
}

export interface SummarizeRisksOpts {
  scan: unknown;
  report: DriftReport;
  brainUrl?: string;
  model?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * Ask the local brain for the top-3 risks. Returns the parsed list, or null on
 * any failure (offline, non-2xx, empty/unparseable reply) so the caller keeps the
 * on-device fallback. A one-shot stateless /turn — no transcript history.
 */
export async function summarizeRisksWithBrain(opts: SummarizeRisksOpts): Promise<TopRisk[] | null> {
  try {
    const content = buildRiskUserContent(opts.scan, opts.report);
    let acc = '';
    for await (const delta of streamBrain({
      brainUrl: opts.brainUrl ?? DEFAULT_BRAIN_URL,
      systemPrompt: RISK_SYSTEM_PROMPT,
      transcript: [{ role: 'user', content: `Scan summary:\n${content}` }],
      model: opts.model ?? DEFAULT_VOICE_MODEL,
      signal: opts.signal,
      fetchImpl: opts.fetchImpl,
    })) {
      acc += delta;
    }
    const risks = parseRiskLines(acc);
    return risks.length ? risks : null;
  } catch {
    return null;
  }
}
