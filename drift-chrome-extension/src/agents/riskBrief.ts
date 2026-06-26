// The GROUNDED risk explanation — the fix for the chat/voice brain confabulating
// "no obvious risks" while the scan verdict said "Address before merge".
//
// Root cause (see chatTools.buildScanContext): the brain only ever received the
// verdict LABEL + a one-line caption — never the actual risk SIGNALS the scanner
// computed. With nothing concrete in context, a risk question got answered from
// the model's imagination. `buildRiskBrief` pulls the real, ranked signals out of
// the raw scan (the act-before-merge quadrant items, the critical metrics, the
// impact-ranked findings, the merge verdict) so `explain_risk` can narrate THEM —
// verbatim, never invented. Pure + fully unit-tested; reads the typed ScanOutput.

import {
  asScanOutput,
  riskItems,
  actBeforeMergeRisks,
  type RiskItem,
  type QualityGauge,
  type TechDebtFinding,
} from '../core/scanOutput';

/** Caps keep the brief inside the ~4k on-device context window AND keep the spoken
 *  form short — ranked, so what survives a cap is always the highest-signal. */
const ACT_BEFORE_CAP = 6;
const MONITOR_CAP = 3;
const GAUGE_CAP = 6;
const FINDINGS_CAP = 5;
const SUGGESTION_CAP = 3;
/** Defensive clamp on any single finding/suggestion sentence. */
const MESSAGE_CAP = 220;

export interface BriefFinding {
  message: string;
  where: string; // "file:line" / function / node id — wherever the scanner pinned it
  category?: string;
  severity?: string;
}

export interface BriefGauge {
  label: string;
  score: number; // 0..100
  level: string; // 'critical' | 'high'
}

export interface RiskBrief {
  /** 'address' when any risk is act-before-merge, else 'review'. */
  verdict: 'address' | 'review';
  verdictLabel: string; // "Address before merge" | composite label | "Reviewed"
  mergeConfidence: number | null; // 0..5
  band: string | null; // A..F
  driftPercent: number | null;
  driftDirection: string | null;
  driftInterpretation: string | null;
  /** Act-before-merge risks, ranked by severity×likelihood, capped. */
  actBefore: RiskItem[];
  /** Monitor-closely risks, ranked, capped. */
  monitor: RiskItem[];
  /** Total risk items the scan flagged (before capping). */
  totalRisks: number;
  /** Critical / high metrics (blast radius, review fatigue, fragility, …), ranked. */
  criticalGauges: BriefGauge[];
  /** Impact-ranked findings over the changed code, with human messages. */
  findings: BriefFinding[];
  suggestionCount: number;
  topSuggestions: string[];
}

const clamp = (s: string): string => (s.length > MESSAGE_CAP ? `${s.slice(0, MESSAGE_CAP - 1).trimEnd()}…` : s);
const pct = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
/** Quadrant priority — distance from the origin of the likelihood×severity map. */
const riskWeight = (r: RiskItem): number => (r.severity ?? 0) * (r.likelihood ?? 0);
const byRisk = (a: RiskItem, b: RiskItem): number => riskWeight(b) - riskWeight(a);

/** How BAD a gauge is, regardless of polarity: a "higher is better" gauge is bad
 *  when LOW, a risk gauge is bad when HIGH. Lets us rank mixed gauges by severity. */
const gaugeBadness = (g: QualityGauge): number => (g.higher_is_better ? 100 - g.score : g.score);
const levelRank = (l: string): number => (l === 'critical' ? 2 : l === 'high' ? 1 : 0);

function findingWhere(f: TechDebtFinding): string {
  if (f.file && typeof f.line === 'number') return `${f.file}:${f.line}`;
  if (f.file) return f.file;
  if (f.function) return f.function;
  if (f.symbol) return f.symbol;
  return f.node_id ?? '';
}

/**
 * Extract the grounded risk signals from a raw scan, or null if the payload isn't
 * a scan at all. Returns a brief even when the PR is LOW risk (no act-before items)
 * — so `explain_risk` can say "no act-before-merge blockers" with authority instead
 * of the model guessing either way.
 */
export function buildRiskBrief(scan: unknown): RiskBrief | null {
  const out = asScanOutput(scan);
  if (!out) return null;

  const items = riskItems(out);
  const actBefore = actBeforeMergeRisks(out).sort(byRisk);
  const monitor = items.filter((r) => r.quadrant === 'monitor_closely').sort(byRisk);

  const composite = out.pr_review_ext?.pr_quality?.composite ?? {};
  const mergeConfidence = typeof composite.score === 'number' ? Math.round(composite.score * 5) : null;
  const verdict: RiskBrief['verdict'] = actBefore.length ? 'address' : 'review';
  const verdictLabel = actBefore.length ? 'Address before merge' : composite.label || 'Reviewed';

  const drift = out.pr_review?.overall_drift;

  const gauges = out.pr_review_ext?.pr_quality?.gauges ?? [];
  const criticalGauges: BriefGauge[] = gauges
    .filter((g) => g.level === 'critical' || g.level === 'high')
    .sort((a, b) => levelRank(b.level) - levelRank(a.level) || gaugeBadness(b) - gaugeBadness(a))
    .slice(0, GAUGE_CAP)
    .map((g) => ({ label: g.label, score: g.score, level: g.level }));

  const techDebt = out.pr_review_ext?.tech_debt;
  const rawFindings = techDebt?.pr_findings_top ?? techDebt?.summary_findings_top ?? [];
  const findings: BriefFinding[] = rawFindings
    .filter((f) => f.message)
    .slice(0, FINDINGS_CAP)
    .map((f) => ({
      message: clamp(f.message!.trim()),
      where: findingWhere(f),
      category: f.category,
      severity: f.severity,
    }));

  const suggestions = out.pr_review?.code_suggestions ?? [];
  const topSuggestions = suggestions
    .map((s) => s?.why_it_matters?.trim())
    .filter((s): s is string => !!s)
    .slice(0, SUGGESTION_CAP)
    .map(clamp);

  return {
    verdict,
    verdictLabel,
    mergeConfidence,
    band: composite.band ?? null,
    driftPercent: typeof drift?.percent === 'number' ? drift.percent : null,
    driftDirection: drift?.direction ?? null,
    driftInterpretation: drift?.interpretation ?? null,
    actBefore: actBefore.slice(0, ACT_BEFORE_CAP),
    monitor: monitor.slice(0, MONITOR_CAP),
    totalRisks: items.length,
    criticalGauges,
    findings,
    suggestionCount: suggestions.length,
    topSuggestions,
  };
}

function riskLine(r: RiskItem): string {
  const sev = typeof r.severity === 'number' && typeof r.likelihood === 'number'
    ? ` — severity ${pct(r.severity)}, likelihood ${pct(r.likelihood)}`
    : '';
  return `• ${r.label}${sev}`;
}

/**
 * Render the brief into the message `explain_risk` emits VERBATIM (`content`) plus a
 * condensed `spoken` variant for TTS. Verbatim emission (like the handover) is the
 * point: it removes the re-generation step where a weak model could re-confabulate.
 */
export function formatRiskBrief(brief: RiskBrief): { content: string; spoken: string } {
  const conf = brief.mergeConfidence != null ? ` (merge confidence ${brief.mergeConfidence}/5)` : '';
  const lines: string[] = [`Risk verdict: ${brief.verdictLabel}${conf}.`];

  if (brief.actBefore.length) {
    lines.push('', `Act on before merge (${brief.actBefore.length}):`, ...brief.actBefore.map(riskLine));
  } else {
    lines.push('', 'No risks were flagged to act on before merge.');
  }

  if (brief.criticalGauges.length) {
    lines.push('', `Critical metrics: ${brief.criticalGauges.map((g) => `${g.label} ${g.score}`).join(', ')}.`);
  }

  if (brief.findings.length) {
    lines.push(
      '',
      'Top findings:',
      ...brief.findings.map((f) => {
        const tag = f.category ? `[${f.category}] ` : '';
        const at = f.where ? ` — ${f.where}` : '';
        return `• ${tag}${f.message}${at}`;
      }),
    );
  }

  if (brief.monitor.length) {
    lines.push('', `Worth monitoring (${brief.monitor.length}):`, ...brief.monitor.map(riskLine));
  }

  if (brief.driftPercent != null) {
    const sign = brief.driftPercent < 0 ? '−' : '+';
    const interp = brief.driftInterpretation ? ` · ${brief.driftInterpretation}` : '';
    lines.push('', `Overall drift ${sign}${Math.abs(brief.driftPercent).toFixed(1)}% (${brief.driftDirection ?? 'neutral'})${interp}.`);
  }

  if (brief.suggestionCount) {
    const top = brief.topSuggestions.length ? `: ${brief.topSuggestions.join('; ')}` : '';
    lines.push('', `${brief.suggestionCount} code suggestion(s)${top}.`);
  }

  lines.push(
    '',
    brief.verdict === 'address'
      ? 'Bottom line: clear the act-before-merge items above before merging.'
      : `Bottom line: no act-before-merge blockers — ${brief.verdictLabel.toLowerCase()}.`,
  );

  return { content: lines.join('\n'), spoken: spokenBrief(brief) };
}

/** A short, naturally-spoken risk summary for voice — top items only, no bullets. */
function spokenBrief(brief: RiskBrief): string {
  const conf = brief.mergeConfidence != null ? `, confidence ${brief.mergeConfidence} out of 5` : '';
  const parts: string[] = [`This PR is rated ${brief.verdictLabel.toLowerCase()}${conf}.`];

  if (brief.actBefore.length) {
    const top = brief.actBefore.slice(0, 3).map((r) => r.label);
    const list = top.length > 1 ? `${top.slice(0, -1).join(', ')}, and ${top[top.length - 1]}` : top[0];
    parts.push(`The main things to address before merge: ${list}.`);
  } else if (brief.criticalGauges.length) {
    parts.push(`No act-before-merge blockers, but watch ${brief.criticalGauges[0].label.toLowerCase()}.`);
  } else {
    parts.push('No act-before-merge blockers were flagged.');
  }
  return parts.join(' ');
}
