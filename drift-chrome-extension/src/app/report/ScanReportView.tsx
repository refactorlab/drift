// ScanReportView — the WHOLE PR report, rendered natively in React from the raw
// `scan-pr.json` (ScanPrOutput). No markdown anywhere: the verdict, headline
// KPIs, the 18-gauge complexity report, architecture diagrams, business value,
// suggestions, risks and extended findings are each their own component.

import { useMemo } from 'react';
import { asScanOutput } from '../../core/scanOutput';
import { ArcGauge, Badge, type Tone } from './primitives';
import { ComplexityReport } from './sections/ComplexityReport';
import { ArchitectureSection } from './sections/ArchitectureSection';
import { ValueSection } from './sections/ValueSection';
import { SuggestionsSection } from './sections/SuggestionsSection';
import { RisksSection } from './sections/RisksSection';
import { ExtendedFindings } from './sections/ExtendedFindings';
import './report.css';

function bandTone(band?: string): Tone {
  switch ((band ?? '').toUpperCase()) {
    case 'A':
    case 'B':
      return 'good';
    case 'C':
      return 'warn';
    case 'D':
    case 'E':
      return 'bad';
    default:
      return 'info';
  }
}

function signedPct(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  return `${r < 0 ? '−' : r > 0 ? '+' : ''}${Math.abs(r)}%`;
}

export function ScanReportView({ scan }: { scan: unknown }) {
  const report = useMemo(() => asScanOutput(scan), [scan]);
  if (!report) {
    return <div className="rp-empty">No structured scan data to display.</div>;
  }

  const review = report.pr_review ?? {};
  const ext = report.pr_review_ext ?? {};
  const quality = ext.pr_quality;
  const composite = quality?.composite;
  const drift = review.overall_drift;
  const risks = review.visual_summary?.risks?.items ?? [];
  const gatingRisks = risks.filter((r) => r.quadrant === 'act_before_merge').length;
  const suggestions = review.code_suggestions ?? [];
  const newTests = review.counts?.new_test_files?.value ?? null;
  const changed = report.pr_scope?.changed_files?.length ?? null;

  const confValue = composite?.score != null ? Math.round(composite.score * 5) : null;
  const confTone: Tone = confValue == null ? 'info' : confValue >= 4 ? 'good' : confValue === 3 ? 'warn' : 'bad';
  const verdictLabel = composite?.label ?? drift?.interpretation ?? 'Reviewed';

  return (
    <div className="rp-root">
      {/* Verdict banner */}
      <div className={`rp-verdict rp-verdict-${bandTone(composite?.band)}`}>
        <div className="rp-verdict-main">
          <span className="rp-verdict-label">{verdictLabel}</span>
          {composite?.band && (
            <Badge tone={bandTone(composite.band)} filled>
              PR health {composite.band}
            </Badge>
          )}
        </div>
        <div className="rp-verdict-sub">
          {[
            confValue != null ? `${confValue}/5 confidence` : null,
            drift ? `${signedPct(drift.percent)} drift` : null,
            `${risks.length} risk${risks.length === 1 ? '' : 's'}`,
            `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`,
            changed != null ? `${changed} file${changed === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>

      {/* Headline KPI dials */}
      <div className="rp-kpis">
        {confValue != null && (
          <ArcGauge label="Merge confidence" value={`${confValue}/5`} fraction={composite!.score ?? 0} tone={confTone} />
        )}
        {drift && (
          <ArcGauge
            label="Drift"
            value={signedPct(drift.percent)}
            fraction={Math.min(1, Math.abs(drift.percent) / 100)}
            tone="info"
          />
        )}
        <ArcGauge
          label="Risks"
          value={String(risks.length)}
          fraction={null}
          tone={gatingRisks ? 'bad' : 'good'}
        />
        <ArcGauge label="Suggestions" value={String(suggestions.length)} fraction={null} tone="info" />
        {newTests != null && (
          <ArcGauge label="New tests" value={String(newTests)} fraction={null} tone={newTests > 0 ? 'good' : 'muted'} />
        )}
      </div>

      {/* Sections — each renders only when it has data */}
      <ComplexityReport quality={quality} />
      <ArchitectureSection
        arch={review.architecture_flow}
        business={review.business_logic}
        keyFiles={review.visual_summary?.key_files}
      />
      <ValueSection value={review.value_card} />
      <SuggestionsSection suggestions={suggestions} />
      <RisksSection visual={review.visual_summary} />
      <ExtendedFindings ext={ext} />
    </div>
  );
}
