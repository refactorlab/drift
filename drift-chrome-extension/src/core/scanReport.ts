// Map a REAL downloaded scan artifact (pr-scan.json, the scanner's native
// `ScanPrOutput`) into the dashboard's `DriftReport` model, so the same UI
// (ReportView) can render real scan data instead of the scraped comment.
//
// Shapes mirror drift-static-profiler/schema/scan_pr_output.openapi.yaml.
// Everything is read defensively — partial scans render what they have.

import type { DriftReport, Gauge, Metric, MetricLevel, MetricSection, Verdict } from './types';

interface QualityGauge {
  id?: string;
  group?: string;
  label?: string;
  score?: number; // 0..100
  level?: string; // low | moderate | high | critical
  arrow?: string; // ↑ risk · ↓ quality
}
interface Composite {
  score?: number; // 0..1
  band?: string; // A..E
  label?: string;
}
interface RiskItem {
  quadrant?: string;
}
interface ScanShape {
  pr_review_ext?: {
    pr_quality?: { gauges?: QualityGauge[]; composite?: Composite };
  };
  pr_review?: {
    overall_drift?: { percent?: number; direction?: string };
    code_suggestions?: unknown[];
    visual_summary?: { risks?: RiskItem[] };
  };
}

const GROUP_ORDER = [
  'LLM Complexity',
  'Comprehensibility',
  'Longevity',
  'Correctness Confidence',
  'Operational',
  'Team & Process',
];

function mapLevel(l?: string): MetricLevel {
  switch (l) {
    case 'low':
      return 'low';
    case 'moderate':
      return 'moderate';
    case 'high':
    case 'critical':
      return 'critical';
    default:
      return 'unknown';
  }
}
function dirFromArrow(a?: string): Metric['direction'] {
  if (!a) return 'none';
  if (a.includes('↑')) return 'up';
  if (a.includes('↓')) return 'down';
  return 'none';
}

/** True when the object looks like a real ScanPrOutput (not our derived shape). */
export function isScanOutput(o: unknown): o is ScanShape {
  if (!o || typeof o !== 'object') return false;
  const s = o as Record<string, unknown>;
  return 'pr_review' in s || 'pr_review_ext' in s || 'pr_scope' in s;
}

/**
 * Graft a scan's full Complexity & Risk sections onto the authoritative
 * comment-scraped report. We deliberately do NOT take the scan's headline
 * merge-confidence/verdict/gauges: the action computes merge confidence from a
 * penalty model (render/lib/confidence.ts), while the scan only carries the
 * quality `composite` score — a different metric. The scan's `criticalCount`
 * also folds "high" into "critical", so it can't override the comment's count.
 * We therefore keep the comment headline and only enrich the sections (the full
 * 18 params) + backfill any summary counts the comment didn't render.
 */
export function enrichWithScan(report: DriftReport, scan: DriftReport | null): DriftReport {
  if (!scan || scan.sections.length === 0) return report;
  return {
    ...report,
    sections: scan.sections,
    blastRadius: report.blastRadius ?? scan.blastRadius,
    criticalCount: report.criticalCount ?? scan.criticalCount,
    metricCount: report.metricCount ?? scan.metricCount,
  };
}

export function scanToReport(scan: unknown, prUrl: string | null): DriftReport | null {
  if (!isScanOutput(scan)) return null;
  const quality = scan.pr_review_ext?.pr_quality ?? {};
  const review = scan.pr_review ?? {};
  const gauges18 = Array.isArray(quality.gauges) ? quality.gauges : [];

  // Sections grouped by gauge.group, ordered per charts-of-metrics.md.
  const byGroup = new Map<string, Metric[]>();
  for (const g of gauges18) {
    const group = g.group || 'Metrics';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push({
      name: g.label || g.id || 'metric',
      level: mapLevel(g.level),
      percent: typeof g.score === 'number' ? g.score : null,
      direction: dirFromArrow(g.arrow),
    });
  }
  const ordered = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const sections: MetricSection[] = ordered.map((title, i) => ({
    index: i + 1,
    title,
    metrics: byGroup.get(title)!,
  }));

  // Headline gauges.
  const gauges: Gauge[] = [];
  const composite = quality.composite ?? {};
  let mergeConfidence: DriftReport['mergeConfidence'] = null;
  if (typeof composite.score === 'number') {
    const v = Math.round(composite.score * 5);
    mergeConfidence = { value: v, outOf: 5 };
    gauges.push({
      key: 'merge-confidence',
      label: 'MERGE CONFIDENCE',
      display: `${v}/5`,
      fraction: composite.score,
      tone: v <= 1 ? 'bad' : v >= 4 ? 'good' : 'warn',
    });
  }
  const driftPct = review.overall_drift?.percent;
  if (typeof driftPct === 'number') {
    gauges.push({
      key: 'drift',
      label: 'DRIFT',
      display: `${driftPct < 0 ? '−' : '+'}${Math.abs(driftPct).toFixed(1)}%`,
      fraction: Math.min(1, Math.abs(driftPct) / 100),
      tone: 'info',
    });
  }
  const risks = Array.isArray(review.visual_summary?.risks) ? review.visual_summary!.risks! : [];
  gauges.push({
    key: 'risks',
    label: 'RISKS',
    display: String(risks.length),
    fraction: null,
    tone: risks.length ? 'bad' : 'good',
  });
  const suggestions = Array.isArray(review.code_suggestions) ? review.code_suggestions : [];
  gauges.push({
    key: 'suggestions',
    label: 'SUGGESTIONS',
    display: String(suggestions.length),
    fraction: null,
    tone: 'info',
  });

  const actBefore = risks.some((r) => r?.quadrant === 'act_before_merge');
  const verdictLabel = actBefore ? 'Address before merge' : composite.label || 'Reviewed';
  const verdict: Verdict = actBefore ? 'address' : 'review';
  const criticalCount = gauges18.filter((g) => mapLevel(g.level) === 'critical').length;
  // Blast radius is one of the 18 gauges — surface it on the summary line too.
  const blastGauge = gauges18.find((g) => /blast radius/i.test(g.label || ''));
  const blastRadius = typeof blastGauge?.score === 'number' ? blastGauge.score : null;

  return {
    found: true,
    demo: false,
    verdict,
    verdictLabel,
    effortLabel: composite.band ? `PR health ${composite.band}` : null,
    mergeConfidence,
    gauges,
    blastRadius,
    criticalCount: criticalCount || null,
    metricCount: gauges18.length || null,
    sections,
    prUrl,
    scrapedAt: 0,
  };
}
