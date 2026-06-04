// Extended findings — the secondary signals: duplication clusters, untested
// entry points, reliability gaps, and tech-debt hotspots. Collapsed by default
// since they're supporting detail, not the headline.

import type { PrReviewExt, TechDebtFinding } from '../../../core/scanOutput';
import { Badge, Collapsible, Section } from '../primitives';

/** Last path segment — a node_id/file path collapsed to its file name. */
function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

/** A tech-debt finding identifies a function by `node_id`
 *  ("/repo/<file>::<Class>::<method>") — `summary_findings_top` carries that
 *  plus `kind`/`line` but NOT `symbol`/`file`, so we derive a readable label
 *  here instead of falling back to the literal word "symbol". */
function techDebtLabel(f: TechDebtFinding): { symbol: string; file?: string; line?: number } {
  if (f.symbol) return { symbol: f.symbol, file: f.file, line: f.line };
  const parts = (f.node_id ?? '').split('::');
  const file = parts[0]?.replace(/^\/repo\//, '') || f.file;
  // The qualifier after the file path ("Class::method") is the symbol; if the
  // node_id is just a file, fall back to the file's basename.
  const symbol = parts.length > 1 ? parts.slice(1).join('::') : file ? basename(file) : 'symbol';
  return { symbol, file, line: f.line };
}

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
            {tdTop.map((f, i) => {
              const { symbol, file, line } = techDebtLabel(f);
              return (
                <li key={i}>
                  <code>{symbol}</code>
                  {f.kind && <span className="rp-muted"> · {f.kind}</span>}
                  {f.value != null && <span className="rp-muted"> · {f.value}</span>}
                  {file && <span className="rp-muted"> · {basename(file)}{line ? `:${line}` : ''}</span>}
                </li>
              );
            })}
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
            {dup.map((c, i) => {
              // A cluster is the SAME symbol duplicated across files — show the
              // name once (distinct, in case names differ), then the files it
              // lives in. Joining member names alone just repeats one name.
              const names = Array.from(new Set(c.members.map((m) => m.name)));
              const files = c.members.map((m) => basename(m.file));
              return (
                <li key={i}>
                  <code>{names.join(' / ')}</code>
                  <span className="rp-muted">
                    {' '}· {c.members.length} copies · {files.join(', ')}
                  </span>
                </li>
              );
            })}
          </ul>
        </Collapsible>
      )}
    </Section>
  );
}
