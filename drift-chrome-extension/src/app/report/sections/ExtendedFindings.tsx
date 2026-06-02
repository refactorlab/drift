// Extended findings — the secondary signals: duplication clusters, untested
// entry points, reliability gaps, and tech-debt hotspots. Collapsed by default
// since they're supporting detail, not the headline.

import type { PrReviewExt } from '../../../core/scanOutput';
import { Badge, Collapsible, Section } from '../primitives';

export function ExtendedFindings({ ext }: { ext?: PrReviewExt }) {
  if (!ext) return null;
  const dup = ext.duplication?.clusters ?? [];
  const uncovered = ext.tests_in_graph?.uncovered_roots ?? [];
  const gaps = ext.nfr_edge_cases?.reliability_gaps ?? [];
  const td = ext.tech_debt;
  const tdTop = td?.summary_findings_top ?? [];
  const highCx = td?.high_complexity?.length ?? 0;
  const longFns = td?.long_functions?.length ?? 0;

  const hasAny = dup.length || uncovered.length || gaps.length || tdTop.length || highCx || longFns;
  if (!hasAny) return null;

  return (
    <Section icon="🔍" title="Extended findings">
      {(highCx > 0 || longFns > 0) && (
        <div className="rp-chips">
          {highCx > 0 && <Badge tone="warn">{highCx} high-complexity</Badge>}
          {longFns > 0 && <Badge tone="warn">{longFns} long function{longFns > 1 ? 's' : ''}</Badge>}
        </div>
      )}

      {tdTop.length > 0 && (
        <Collapsible title="Tech-debt hotspots" subtitle={<Badge>{tdTop.length}</Badge>}>
          <ul className="rp-list">
            {tdTop.map((f, i) => (
              <li key={i}>
                <code>{f.symbol ?? f.file ?? 'symbol'}</code>
                {f.value != null && <span className="rp-muted"> · {f.value}</span>}
                {f.file && <span className="rp-muted"> · {f.file}{f.line ? `:${f.line}` : ''}</span>}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      {uncovered.length > 0 && (
        <Collapsible title="Untested entry points" subtitle={<Badge tone="warn">{uncovered.length}</Badge>}>
          <ul className="rp-list">
            {uncovered.map((r, i) => (
              <li key={i}><code>{r}</code></li>
            ))}
          </ul>
        </Collapsible>
      )}

      {gaps.length > 0 && (
        <Collapsible title="Reliability gaps" subtitle={<Badge tone="warn">{gaps.length}</Badge>}>
          <ul className="rp-list">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Collapsible>
      )}

      {dup.length > 0 && (
        <Collapsible title="Duplication clusters" subtitle={<Badge>{dup.length}</Badge>}>
          <ul className="rp-list">
            {dup.map((c, i) => (
              <li key={i}>{c.members.map((m) => m.name).join(' · ')}</li>
            ))}
          </ul>
        </Collapsible>
      )}
    </Section>
  );
}
