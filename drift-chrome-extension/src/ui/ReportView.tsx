// The shared report dashboard, rendered identically in the popup, the side
// panel, and the injected in-page panel.

import type { DriftReport, Metric, MetricSection } from '../core/types';
import { Dial } from './Dial';

const TONE_COLOR: Record<string, string> = {
  good: 'var(--drift-good)',
  warn: 'var(--drift-warn)',
  bad: 'var(--drift-bad-soft)',
  info: 'var(--drift-info)',
};

function GaugeCard({ gauge }: { gauge: DriftReport['gauges'][number] }) {
  return (
    <div className="drift-gauge">
      <Dial gauge={gauge} />
      <div className="val" style={{ color: TONE_COLOR[gauge.tone] }}>
        {gauge.display}
      </div>
      <div className="lbl">{gauge.label}</div>
    </div>
  );
}

function arrow(dir: Metric['direction']): string {
  return dir === 'up' ? '↑' : dir === 'down' ? '↓' : '';
}

function MetricRow({ metric }: { metric: Metric }) {
  const pct = metric.percent ?? 0;
  return (
    <div className="drift-metric">
      <div className="top">
        <span className="name">{metric.name}</span>
        <span className="pct">
          <span className={`drift-pill pill-${metric.level}`}>{metric.level}</span>{' '}
          {metric.percent !== null ? `${metric.percent}% ${arrow(metric.direction)}` : ''}
        </span>
      </div>
      <div className={`drift-bar lvl-${metric.level}`}>
        <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function Section({ section }: { section: MetricSection }) {
  return (
    <div className="drift-section">
      <h2>
        <span className="idx">{section.index}</span>
        {section.title}
      </h2>
      {section.metrics.map((m) => (
        <MetricRow key={m.name} metric={m} />
      ))}
    </div>
  );
}

export function ReportView({ report }: { report: DriftReport }) {
  if (!report.found) {
    return (
      <div className="drift-empty">
        <div className="big">🔍</div>
        <div>No Drift report on this page.</div>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          Open a pull request that has an Andy / Drift comment.
        </div>
      </div>
    );
  }

  const verdictClass =
    report.verdict === 'address'
      ? 'address'
      : report.verdict === 'approve'
        ? 'approve'
        : 'review';

  return (
    <>
      <div className={`drift-verdict ${verdictClass}`}>
        <span>{report.verdictLabel || 'Drift report'}</span>
        {report.effortLabel && <span className="sub">· {report.effortLabel}</span>}
      </div>

      {report.gauges.length > 0 && (
        <div className="drift-gauges">
          {report.gauges.map((g) => (
            <GaugeCard key={g.key} gauge={g} />
          ))}
        </div>
      )}

      {(report.blastRadius !== null || report.metricCount !== null) && (
        <div className="drift-section">
          <h2>Complexity &amp; Risk</h2>
          <div style={{ fontSize: 12, color: 'var(--drift-fg-muted)' }}>
            {report.blastRadius !== null && <>Blast radius {report.blastRadius} · </>}
            {report.criticalCount !== null && <>{report.criticalCount} critical · </>}
            {report.metricCount !== null && <>{report.metricCount} metrics</>}
          </div>
        </div>
      )}

      {report.sections.map((s) => (
        <Section key={s.index} section={s} />
      ))}
    </>
  );
}
