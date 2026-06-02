// Complexity & Risk Report — the 18 quality gauges, grouped into their 6
// dimensions, with a radar overview and an LLM-context verdict. Rendered
// natively from `pr_review_ext.pr_quality`, replacing the markdown gauge bars.

import type { PrQuality, QualityGauge } from '../../../core/scanOutput';
import { groupGauges } from '../../../core/scanOutput';
import { Badge, Meter, Section, toneForLevel } from '../primitives';
import { RadarChart } from '../RadarChart';

function levelLabel(g: QualityGauge): string {
  return g.level ? g.level.toUpperCase() : '—';
}

function MetricRow({ g }: { g: QualityGauge }) {
  const tone = toneForLevel(g.level);
  return (
    <div className="rp-metric">
      <div className="rp-metric-top">
        <span className="rp-metric-name">{g.label}</span>
        <span className="rp-metric-tags">
          <Badge tone={tone} filled={g.level === 'critical'}>{levelLabel(g)}</Badge>
          <span className="rp-metric-score">
            {Math.round(g.score)}
            {g.arrow ? <span className="rp-metric-arrow"> {g.arrow}</span> : null}
          </span>
        </span>
      </div>
      <Meter percent={g.score} tone={tone} />
      {g.description && <p className="rp-metric-desc">{g.description}</p>}
    </div>
  );
}

export function ComplexityReport({ quality }: { quality?: PrQuality }) {
  const gauges = quality?.gauges ?? [];
  if (gauges.length === 0) return null;

  const groups = groupGauges(gauges);
  const summary = quality?.gauge_summary;
  const fits = summary?.context_fits;
  const tokenChip =
    summary?.token_estimate != null
      ? `${(summary.token_estimate / 1000).toFixed(0)}K tokens`
      : null;

  return (
    <Section
      icon="📊"
      title="Complexity & Risk Report"
      action={
        tokenChip ? (
          <Badge tone={fits ? 'good' : 'warn'}>
            {fits ? 'Fits' : 'Tight'} · {tokenChip}
          </Badge>
        ) : undefined
      }
    >
      <div className="rp-radar-wrap">
        <RadarChart axes={gauges.map((g) => ({ label: g.label, score: g.score }))} />
      </div>

      <div className="rp-groups">
        {groups.map(({ group, gauges: gs }) => (
          <div key={group} className="rp-group">
            <div className="rp-group-head">{group}</div>
            {gs.map((g) => (
              <MetricRow key={g.id} g={g} />
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
