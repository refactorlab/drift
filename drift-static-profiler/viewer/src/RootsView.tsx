import { useMemo, useState } from 'react';
import { CATEGORY_COLORS } from './types';
import { Help } from './Help';
import { TIPS } from './tooltips';
import { ResizeHandle, useResizableColumns, type ColumnDef } from './useResizableColumns';
import type { CallTreeNode, Category } from './types';

interface Props {
  roots: CallTreeNode[];
  activeRootId: string | null;
  onSelect: (id: string) => void;
}

type SortKey = 'reach' | 'complexity' | 'pagerank' | 'name' | 'smells';
type SortDir = 'asc' | 'desc';

// All column widths in pixels. Flex behavior is gone in favor of explicit
// widths so drag-to-resize works uniformly across the table. Kind was
// bumped from 64 → 80 so "FUNCTION" fits at the default zoom.
const COLUMNS: ColumnDef[] = [
  { id: 'rank',       defaultWidth: 36,  minWidth: 28 },
  { id: 'name',       defaultWidth: 280, minWidth: 100 },
  { id: 'file',       defaultWidth: 220, minWidth: 80 },
  { id: 'kind',       defaultWidth: 80,  minWidth: 48 },
  { id: 'reach',      defaultWidth: 64,  minWidth: 40 },
  { id: 'cx',         defaultWidth: 48,  minWidth: 32 },
  { id: 'categories', defaultWidth: 180, minWidth: 80 },
  { id: 'smells',     defaultWidth: 62,  minWidth: 40 },
  { id: 'pr',         defaultWidth: 56,  minWidth: 40 },
];

// Mirrors the static-analysis "root view" pattern from Chrome DevTools'
// Top-Down (root activities), pprof's `top -cum`, Speedscope's Sandwich,
// and IntelliJ's Method List: a sortable table of entry-point symbols
// ranked by cumulative reach. Clicking a row drills the rest of the
// viewer into that root's flame graph + call tree.
export function RootsView({ roots, activeRootId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('reach');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const cols = useResizableColumns('drift.rootsView.cols', COLUMNS);

  const sorted = useMemo(() => {
    const rows = roots.map(r => ({
      root: r,
      smells: countSmells(r),
    }));
    rows.sort((a, b) => {
      const av = pluck(a, sortKey);
      const bv = pluck(b, sortKey);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av), bn = Number(bv);
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return rows;
  }, [roots, sortKey, sortDir]);

  if (roots.length === 0) {
    return (
      <div style={emptyStyle}>
        No roots in this report. Generate one with{' '}
        <code style={codeInlineStyle}>make scan-roots SCAN_PATH=…</code>.
      </div>
    );
  }

  const flip = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'name' ? 'asc' : 'desc');
    }
  };

  const arrow = (k: SortKey) =>
    sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '';

  const w = cols.widths;
  const headCell = (id: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...cellStyle,
    width: w[id],
    color: '#7e8189',
    position: 'relative',
    ...extra,
  });

  return (
    <div style={containerStyle}>
      <div style={hintStyle}>
        Auto-discovered root entry points (symbols with no in-graph caller). Click a row to
        drill into its flame graph and call tree. Ranked like pprof's <code style={codeInlineStyle}>top -cum</code>{' '}
        and Chrome DevTools' Top-Down view. <Help text={TIPS.tab_roots} /> <span style={{ color: '#5f626a' }}>· drag column edges to resize</span>
      </div>
      <div style={tableStyle}>
        <div style={headRowStyle}>
          <div style={headCell('rank')}>
            <Help text={TIPS.col_rank}>#</Help>
            <ResizeHandle onMouseDown={cols.startResize('rank')} onReset={() => cols.resetColumn('rank')} />
          </div>
          <Th id="name" w={w.name} sortable onClick={() => flip('name')} arrow={arrow('name')} title="Function or method name (parent class prefixed when applicable). Click to sort alphabetically." label="Name" cols={cols} />
          <div style={headCell('file')}>
            <Help text={TIPS.col_file_line}>File</Help>
            <ResizeHandle onMouseDown={cols.startResize('file')} onReset={() => cols.resetColumn('file')} />
          </div>
          <div style={headCell('kind')}>
            <Help text={TIPS.col_kind}>Kind</Help>
            <ResizeHandle onMouseDown={cols.startResize('kind')} onReset={() => cols.resetColumn('kind')} />
          </div>
          <Th id="reach" w={w.reach} sortable onClick={() => flip('reach')} arrow={arrow('reach')} label="Reach" title={TIPS.col_reach} cols={cols} />
          <Th id="cx" w={w.cx} sortable onClick={() => flip('complexity')} arrow={arrow('complexity')} label="Cx" title={TIPS.col_cx} cols={cols} />
          <div style={headCell('categories')}>
            <Help text={TIPS.col_categories}>Categories</Help>
            <ResizeHandle onMouseDown={cols.startResize('categories')} onReset={() => cols.resetColumn('categories')} />
          </div>
          <Th id="smells" w={w.smells} sortable onClick={() => flip('smells')} arrow={arrow('smells')} label="Smells" title={TIPS.col_smells} cols={cols} />
          <Th id="pr" w={w.pr} sortable onClick={() => flip('pagerank')} arrow={arrow('pagerank')} label="PR" title={TIPS.col_pr} cols={cols} />
        </div>
        <div style={bodyStyle}>
          {sorted.map((row, i) => {
            const r = row.root;
            const isActive = r.id === activeRootId;
            const fullName = (r.parent_class ? `${r.parent_class}.` : '') + r.name;
            return (
              <div
                key={r.id}
                style={{ ...rowStyle, ...(isActive ? activeRowStyle : {}) }}
                onClick={() => onSelect(r.id)}
                title={`Click to focus the flame graph + call tree on ${fullName}. (${r.file}:${r.line})`}
              >
                <div style={{ ...cellStyle, width: w.rank, color: '#7e8189' }} title={`Rank #${i + 1} after sorting.`}>{i + 1}</div>
                <div style={{ ...cellStyle, width: w.name, fontFamily: 'ui-monospace, monospace' }} title={fullName}>
                  <span style={nameStyle}>{fullName}</span>
                  {r.is_async && (
                    <span
                      style={asyncBadgeStyle}
                      title={`async — uses async/await. ${TIPS.is_async}`}
                    >
                      async
                    </span>
                  )}
                </div>
                <div
                  style={{ ...cellStyle, width: w.file, color: '#9ca0a8', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
                  title={`${r.file}:${r.line} — ${TIPS.col_file_line}`}
                >
                  {r.file}:{r.line}
                </div>
                <div style={{ ...cellStyle, width: w.kind }}>
                  <span style={kindStyle(r.kind)} title={TIPS[`kind_${r.kind.toLowerCase()}`] ?? TIPS.col_kind}>
                    {r.kind.toLowerCase()}
                  </span>
                </div>
                <div
                  style={{ ...cellStyle, width: w.reach, fontVariantNumeric: 'tabular-nums' }}
                  title={`Reach = ${r.subtree_size} transitively reachable symbols (deduped). ${TIPS.col_reach}`}
                >
                  {r.subtree_size}
                </div>
                <div
                  style={{ ...cellStyle, width: w.cx, fontVariantNumeric: 'tabular-nums', color: cxColor(r.complexity) }}
                  title={`Cx = ${r.complexity} (cyclomatic complexity). ${TIPS.col_cx}`}
                >
                  {r.complexity}
                </div>
                <div style={{ ...cellStyle, width: w.categories }} title={TIPS.col_categories}>
                  <CategoryChips reached={r.categories_reached} />
                </div>
                <div
                  style={{ ...cellStyle, width: w.smells, fontVariantNumeric: 'tabular-nums' }}
                  title={row.smells === 0 ? 'No smells in this subtree.' : `${row.smells} smell(s) detected. ${TIPS.col_smells}`}
                >
                  <SmellBadge count={row.smells} />
                </div>
                <div
                  style={{ ...cellStyle, width: w.pr, fontVariantNumeric: 'tabular-nums', color: '#9ca0a8' }}
                  title={r.pagerank ? `PR = ${r.pagerank.toFixed(4)} (PageRank). ${TIPS.col_pr}` : `PageRank not available. ${TIPS.col_pr}`}
                >
                  {r.pagerank ? r.pagerank.toFixed(3) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pluck(row: { root: CallTreeNode; smells: number }, k: SortKey): number | string {
  const r = row.root;
  switch (k) {
    case 'reach': return r.subtree_size;
    case 'complexity': return r.complexity;
    case 'pagerank': return r.pagerank ?? 0;
    case 'smells': return row.smells;
    case 'name': return (r.parent_class ? `${r.parent_class}.` : '') + r.name;
  }
}

function countSmells(root: CallTreeNode): number {
  let n = 0;
  const visit = (x: CallTreeNode) => {
    if (x.n_plus_one_risk) n++;
    if (x.blocking_in_async) n++;
    if (x.is_recursive) n++;
    for (const c of x.children) visit(c);
  };
  visit(root);
  return n;
}

interface ThProps {
  id: string;
  w: number;
  label: string;
  sortable: boolean;
  onClick: () => void;
  arrow: string;
  title?: string;
  cols: ReturnType<typeof useResizableColumns>;
}

function Th({ id, w, label, onClick, arrow, title, cols }: ThProps) {
  return (
    <div
      style={{
        ...cellStyle,
        width: w,
        cursor: 'pointer',
        userSelect: 'none',
        color: '#9ca0a8',
        fontWeight: 600,
        position: 'relative',
      }}
      onClick={onClick}
    >
      {title ? <Help text={title}>{label}</Help> : label}{' '}
      <span style={{ color: '#5b8def' }}>{arrow}</span>
      <ResizeHandle
        onMouseDown={cols.startResize(id)}
        onReset={() => cols.resetColumn(id)}
      />
    </div>
  );
}

function CategoryChips({ reached }: { reached: Record<string, number> }) {
  const entries = Object.entries(reached).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span style={{ color: '#6e717a' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {entries.map(([cat, n]) => (
        <span
          key={cat}
          style={{
            background: CATEGORY_COLORS[cat as Category] ?? '#3a3f47',
            color: '#0a0a14',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
          title={TIPS[`category_${cat}`] ?? cat}
        >
          {cat}:{n}
        </span>
      ))}
    </span>
  );
}

function SmellBadge({ count }: { count: number }) {
  if (count === 0) return <span style={{ color: '#6e717a' }}>0</span>;
  return (
    <span
      style={{
        background: count > 3 ? '#7a2f2f' : '#3a3326',
        color: count > 3 ? '#ffb0b0' : '#ffd569',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {count}
    </span>
  );
}

function cxColor(c: number): string {
  if (c >= 15) return '#ff7e7e';
  if (c >= 10) return '#e26d6d';
  if (c >= 5) return '#e0a458';
  return '#d7d9dc';
}

function kindStyle(kind: string): React.CSSProperties {
  const colors: Record<string, string> = {
    Function: '#5b8def',
    Method:   '#48a999',
    Class:    '#e0a458',
  };
  return {
    color: colors[kind] ?? '#9ca0a8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 700,
  };
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontSize: 12,
};
const hintStyle: React.CSSProperties = {
  color: '#7e8189',
  fontSize: 11,
  padding: '6px 12px',
  borderBottom: '1px solid #2f3136',
  fontStyle: 'italic',
};
const tableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'auto',  // horizontal scroll when columns total > viewport width
};
const headRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  background: '#26282c',
  borderBottom: '1px solid #3f4147',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontWeight: 700,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  width: 'fit-content',
  minWidth: '100%',
};
const bodyStyle: React.CSSProperties = {
  flex: 1,
  // body width matches header so columns align even when scrolled
  width: 'fit-content',
  minWidth: '100%',
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '5px 8px',
  borderBottom: '1px solid #2a2c30',
  cursor: 'pointer',
};
const activeRowStyle: React.CSSProperties = {
  background: '#2b3a5a',
};
const cellStyle: React.CSSProperties = {
  // Padding-right is generous (10px) so the resize-handle line at the
  // cell's right edge doesn't visually crowd the text. Padding-left
  // stays tight (6px) since text aligns left and there's no handle on
  // the left edge.
  padding: '0 10px 0 6px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  boxSizing: 'border-box',
};
const nameStyle: React.CSSProperties = {
  color: '#d7d9dc',
};
const asyncBadgeStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '0 5px',
  borderRadius: 3,
  background: '#3a2647',
  color: '#d09bd1',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
};
const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#6e717a',
  fontStyle: 'italic',
  fontSize: 12,
};
const codeInlineStyle: React.CSSProperties = {
  background: '#2f3136',
  padding: '1px 5px',
  borderRadius: 2,
  fontFamily: 'ui-monospace, monospace',
  color: '#d7d9dc',
};
