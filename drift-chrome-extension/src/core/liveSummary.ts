// Pure presentation helpers for the live-scan result. Kept free of React and of
// the Web Speech API so they unit-test in plain node: `buildNarration` produces
// the spoken-summary script and `summaryLine` the one-line caption — both read
// the same `DriftReport` the on-page comment renders from (via scanToReport).

import type { DriftReport, Gauge } from './types';

export type LiveScanMeta = {
  repo: string;
  owner?: string;
  number: number;
  title?: string | null;
  /** Files changed between base..head (from the local tree diff). */
  changedFiles: number;
};

function gauge(report: DriftReport, key: string): Gauge | undefined {
  return report.gauges.find((g) => g.key === key);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A compact one-line caption for the result header, e.g. "3/5 · +5.5% drift · 2 risks · 12 files". */
export function summaryLine(report: DriftReport, meta: LiveScanMeta): string {
  const parts: string[] = [];
  if (report.mergeConfidence) parts.push(`${report.mergeConfidence.value}/${report.mergeConfidence.outOf} confidence`);
  const drift = gauge(report, 'drift');
  if (drift) parts.push(`${drift.display} drift`);
  const risks = gauge(report, 'risks');
  if (risks) parts.push(`${risks.display} risk${risks.display === '1' ? '' : 's'}`);
  parts.push(plural(meta.changedFiles, 'file'));
  return parts.join(' · ');
}

/**
 * Build the spoken-summary script from the report. Written for a text-to-speech
 * voice: short declarative sentences, numbers spoken naturally, sections skipped
 * when their data is absent (a partial scan narrates only what it has).
 */
export function buildNarration(report: DriftReport, meta: LiveScanMeta): string {
  const s: string[] = [];

  // Opening — what was scanned.
  const title = meta.title?.trim();
  s.push(
    `Drift live scan of ${meta.repo}, pull request ${meta.number}` +
      (title ? `: ${title}.` : '.'),
  );
  s.push(`${plural(meta.changedFiles, 'file')} changed.`);

  // Headline confidence + drift.
  if (report.mergeConfidence) {
    s.push(`Merge confidence ${report.mergeConfidence.value} out of ${report.mergeConfidence.outOf}.`);
  }
  const drift = gauge(report, 'drift');
  if (drift) {
    const dir = drift.display.startsWith('−') || drift.display.startsWith('-') ? 'down' : 'up';
    const mag = drift.display.replace(/^[−+-]/, '');
    s.push(`Overall drift ${dir} ${mag}.`);
  }

  // Risks + suggestions.
  const risks = Number(gauge(report, 'risks')?.display ?? 0);
  const suggestions = Number(gauge(report, 'suggestions')?.display ?? 0);
  if (risks || suggestions) {
    const bits: string[] = [];
    if (risks) bits.push(`${plural(risks, 'risk')} flagged`);
    if (suggestions) bits.push(`${plural(suggestions, 'code suggestion')}`);
    s.push(`${bits.join(' and ')}.`);
  }

  // Critical metrics — name the worst few so the listener knows where to look.
  if (report.criticalCount && report.metricCount) {
    const critical = report.sections
      .flatMap((sec) => sec.metrics)
      .filter((m) => m.level === 'critical')
      .map((m) => m.name);
    const named = critical.slice(0, 3).join(', ');
    s.push(
      `${plural(report.criticalCount, 'critical metric')} across ${report.metricCount} measured` +
        (named ? `: ${named}.` : '.'),
    );
  }

  // Verdict — the takeaway, last so it lands.
  if (report.verdictLabel) s.push(`Verdict: ${report.verdictLabel}.`);

  return s.join(' ');
}
