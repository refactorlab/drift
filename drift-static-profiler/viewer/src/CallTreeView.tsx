import { useState } from 'react';
import { CATEGORY_COLORS } from './types';
import { TIPS } from './tooltips';
import { Help } from './Help';
import { ResizeHandle, useResizableColumns, type ColumnDef } from './useResizableColumns';
import type { CallTreeNode, SymbolKind } from './types';

interface Props {
  root: CallTreeNode;
  search: string;
  selectedId: string | null;
  onSelect: (node: CallTreeNode) => void;
}

// Symbol column is now a fixed width (default 400) instead of flex:1 so
// resizing works uniformly. Depth indent eats into the symbol cell's
// available width (overflow:hidden + ellipsis on the name), keeping the
// metric columns aligned across rows of different depths.
//
// Defaults bumped from the original tight widths so each header has
// breathing room between the text and the column-divider line. Math:
// header text (e.g. "%TOTAL" ~50px in uppercase + letter-spacing) + 10px
// paddingRight (set in colStyle) + a few px slack.
const COLUMNS: ColumnDef[] = [
  { id: 'symbol',    defaultWidth: 400, minWidth: 120 },
  { id: 'pct_total', defaultWidth: 72,  minWidth: 56 },
  { id: 'pct_par',   defaultWidth: 64,  minWidth: 50 },
  { id: 'cplx',      defaultWidth: 60,  minWidth: 44 },
  { id: 'loc',       defaultWidth: 52,  minWidth: 40 },
  { id: 'calls',     defaultWidth: 76,  minWidth: 56 },
  { id: 'rank',      defaultWidth: 66,  minWidth: 50 },
  { id: 'smells',    defaultWidth: 92,  minWidth: 56 },
  { id: 'location',  defaultWidth: 240, minWidth: 100 },
];

export function CallTreeView({ root, search, selectedId, onSelect }: Props) {
  // Version-bumped key so users get fresh defaults after the column-padding
  // fix; old narrow widths would clip header text against the resize line.
  const cols = useResizableColumns('drift.callTree.cols.v2', COLUMNS);
  return (
    <div style={containerStyle}>
      <HeaderRow cols={cols} />
      <TreeRow
        node={root}
        depth={0}
        search={search}
        selectedId={selectedId}
        onSelect={onSelect}
        widths={cols.widths}
        initiallyOpen
      />
    </div>
  );
}

interface HeaderRowProps {
  cols: ReturnType<typeof useResizableColumns>;
}

function HeaderRow({ cols }: HeaderRowProps) {
  const w = cols.widths;
  const head = (id: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...colStyle,
    width: w[id],
    position: 'relative',
    ...extra,
  });
  return (
    <div style={headerRowStyle}>
      <span style={{ width: w.symbol, textAlign: 'left', position: 'relative', paddingLeft: 8 }}>
        <Help text={TIPS.col_symbol}>symbol</Help>
        <ResizeHandle onMouseDown={cols.startResize('symbol')} onReset={() => cols.resetColumn('symbol')} />
      </span>
      <span style={head('pct_total')}>
        <Help text={TIPS.percent_total}>%total</Help>
        <ResizeHandle onMouseDown={cols.startResize('pct_total')} onReset={() => cols.resetColumn('pct_total')} />
      </span>
      <span style={head('pct_par')}>
        <Help text={TIPS.percent_parent}>%par</Help>
        <ResizeHandle onMouseDown={cols.startResize('pct_par')} onReset={() => cols.resetColumn('pct_par')} />
      </span>
      <span style={head('cplx')}>
        <Help text={TIPS.complexity}>cplx</Help>
        <ResizeHandle onMouseDown={cols.startResize('cplx')} onReset={() => cols.resetColumn('cplx')} />
      </span>
      <span style={head('loc')}>
        <Help text={TIPS.loc}>loc</Help>
        <ResizeHandle onMouseDown={cols.startResize('loc')} onReset={() => cols.resetColumn('loc')} />
      </span>
      <span style={head('calls')}>
        <Help text={`${TIPS.call_site_count}\n\nDisplayed as call_site_count / callers_count.`}>calls</Help>
        <ResizeHandle onMouseDown={cols.startResize('calls')} onReset={() => cols.resetColumn('calls')} />
      </span>
      <span style={head('rank')}>
        <Help text={TIPS.pagerank}>rank</Help>
        <ResizeHandle onMouseDown={cols.startResize('rank')} onReset={() => cols.resetColumn('rank')} />
      </span>
      <span style={head('smells')}>
        <Help text="Detected static smells (N+1, blocking I/O, recursion). Each is a known antipattern.">smells</Help>
        <ResizeHandle onMouseDown={cols.startResize('smells')} onReset={() => cols.resetColumn('smells')} />
      </span>
      <span style={head('location', { textAlign: 'left', paddingLeft: 8 })}>
        <Help text={TIPS.col_file_line}>file:line</Help>
        <ResizeHandle onMouseDown={cols.startResize('location')} onReset={() => cols.resetColumn('location')} />
      </span>
    </div>
  );
}

interface RowProps {
  node: CallTreeNode;
  depth: number;
  search: string;
  selectedId: string | null;
  onSelect: (node: CallTreeNode) => void;
  widths: Record<string, number>;
  initiallyOpen?: boolean;
}

function TreeRow({ node, depth, search, selectedId, onSelect, widths, initiallyOpen }: RowProps) {
  const [open, setOpen] = useState(initiallyOpen ?? depth < 3);
  const hasChildren = node.children.length > 0;
  const isMatch = !!search && node.name.toLowerCase().includes(search.toLowerCase());
  const isSelected = selectedId === node.id;
  const reachesDb = (node.categories_reached?.db ?? 0) > 0;
  const w = widths;
  return (
    <>
      <div
        style={{
          ...rowStyle,
          background: isSelected
            ? '#2f436a'
            : node.n_plus_one_risk || node.blocking_in_async
            ? '#3a2630'
            : isMatch
            ? '#3a3326'
            : 'transparent',
        }}
        onClick={() => onSelect(node)}
      >
        {/* Symbol cell — fixed width; depth indent lives INSIDE this cell
            so metric columns stay aligned across rows of varying depth. */}
        <span style={{
          width: w.symbol,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          paddingLeft: 8 + depth * 14,
          boxSizing: 'border-box',
        }}>
          <span
            style={caretStyle(hasChildren)}
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          >
            {hasChildren ? (open ? '▾' : '▸') : '·'}
          </span>
          <KindBadge kind={node.kind} />
          {node.is_async && <AsyncBadge />}
          {node.category_self && (
            <span
              title={`Self category: ${node.category_self}. This symbol DIRECTLY makes a ${node.category_self} call (vs. just reaching one transitively).\n\n${TIPS[`category_${node.category_self}`] ?? ''}`}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                background: CATEGORY_COLORS[node.category_self],
                borderRadius: 2,
                marginRight: 2,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ ...nameStyle(isMatch), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.parent_class ? <span style={parentStyle}>{node.parent_class}.</span> : null}
            {node.name}
            {reachesDb && <span style={dbTagStyle} title={TIPS.reaches_db_dot}>·db</span>}
          </span>
        </span>
        <span style={{ ...colStyle, width: w.pct_total }}>{fmtPct(node.percent_total)}</span>
        <span style={{ ...colStyle, width: w.pct_par }}>{fmtPct(node.percent_parent)}</span>
        <span style={{ ...colStyle, width: w.cplx, color: complexityColor(node.complexity) }}>
          {node.complexity ?? 0}
        </span>
        <span style={{ ...colStyle, width: w.loc }}>{node.loc ?? 0}</span>
        <span style={{ ...colStyle, width: w.calls }} title={`call_site_count=${node.call_site_count}; unique callers=${node.callers_count}`}>
          {node.call_site_count}/{node.callers_count}
        </span>
        <span style={{ ...colStyle, width: w.rank }} title={`PageRank ${node.pagerank?.toFixed(4)}`}>
          {node.pagerank ? node.pagerank.toFixed(3) : '—'}
        </span>
        <span style={{ ...colStyle, width: w.smells }}>
          <Smells node={node} />
        </span>
        <span style={{ ...colStyle, width: w.location, textAlign: 'left', paddingLeft: 8, color: '#7e8189', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.file}:{node.line}
        </span>
        {node.truncated_reason && <span style={truncStyle}>[{node.truncated_reason}]</span>}
      </div>
      {open && hasChildren && node.children.map(c => (
        <TreeRow
          key={c.id + depth}
          node={c}
          depth={depth + 1}
          search={search}
          selectedId={selectedId}
          onSelect={onSelect}
          widths={widths}
        />
      ))}
    </>
  );
}

function Smells({ node }: { node: CallTreeNode }) {
  // Each badge's title explains the abbreviation AND the antipattern, so the
  // user doesn't need to guess what "N+1" / "BLK" / "REC" mean.
  const items: { label: string; color: string; title: string }[] = [];
  if (node.n_plus_one_risk) items.push({ label: 'N+1', color: '#e26d6d', title: TIPS.smell_n_plus_one });
  if (node.blocking_in_async) items.push({ label: 'BLK', color: '#ff7e7e', title: `BLK = blocking-in-async.\n\n${TIPS.smell_blocking}` });
  if (node.is_recursive) items.push({ label: 'REC', color: '#d09bd1', title: `REC = recursive.\n\n${TIPS.smell_recursive}` });
  if (items.length === 0) return <span style={{ color: '#3f4147' }} title="No smells detected in this symbol's own body.">—</span>;
  return (
    <span style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      {items.map((i) => (
        <span key={i.label} title={i.title} style={{
          fontSize: 9,
          fontWeight: 700,
          padding: '1px 4px',
          borderRadius: 2,
          background: i.color,
          color: '#0a0a14',
          cursor: 'help',
        }}>{i.label}</span>
      ))}
    </span>
  );
}

function KindBadge({ kind }: { kind: SymbolKind }) {
  const map: Record<SymbolKind, { label: string; bg: string; tip: string }> = {
    Function: { label: 'fn',  bg: '#5b8def', tip: TIPS.kind_function },
    Method:   { label: 'm',   bg: '#48a999', tip: TIPS.kind_method },
    Class:    { label: 'cls', bg: '#e0a458', tip: TIPS.kind_class },
  };
  const { label, bg, tip } = map[kind];
  return <span title={tip} style={{ ...badgeStyle, background: bg, cursor: 'help' }}>{label}</span>;
}

function AsyncBadge() {
  return (
    <span
      title={`α = async. ${TIPS.kind_async_marker}`}
      style={{ ...badgeStyle, background: '#7e6ff0', cursor: 'help' }}
    >
      α
    </span>
  );
}

function fmtPct(p: number | undefined): string {
  if (p == null) return '—';
  if (p >= 99.95) return '100%';
  return `${p.toFixed(1)}%`;
}

function complexityColor(c: number | undefined): string {
  if (!c) return '#7e8189';
  if (c >= 15) return '#e26d6d';
  if (c >= 10) return '#e0a458';
  if (c >= 5)  return '#d7d9dc';
  return '#7e8189';
}

const containerStyle: React.CSSProperties = {
  overflow: 'auto',  // both x and y — wide tables scroll horizontally
  height: '100%',
  background: '#1e1f22',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: '#26282c',
  borderBottom: '1px solid #3f4147',
  position: 'sticky',
  top: 0,
  fontWeight: 700,
  fontSize: 10,
  color: '#9ca0a8',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  zIndex: 2,
  width: 'fit-content',
  minWidth: '100%',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 8px',
  cursor: 'pointer',
  borderBottom: '1px solid #25272a',
  userSelect: 'none',
  width: 'fit-content',
  minWidth: '100%',
};

const colStyle: React.CSSProperties = {
  textAlign: 'right',
  color: '#9ca0a8',
  fontVariantNumeric: 'tabular-nums',
  boxSizing: 'border-box',
  // Padding-right keeps text from crowding the resize-handle line that
  // sits at the cell's right edge. Without this, narrow columns
  // (cplx/loc/rank) render the last letter directly under the line.
  paddingRight: 10,
};

const caretStyle = (active: boolean): React.CSSProperties => ({
  width: 12, color: active ? '#9ca0a8' : '#3f4147', cursor: active ? 'pointer' : 'default',
  flexShrink: 0,
});

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 22,
  textAlign: 'center',
  padding: '0 4px',
  borderRadius: 3,
  color: '#0a0a14',
  fontWeight: 600,
  fontSize: 10,
  flexShrink: 0,
};

const nameStyle = (highlight: boolean): React.CSSProperties => ({
  color: highlight ? '#ffd569' : '#d7d9dc',
  fontWeight: highlight ? 600 : 400,
});

const parentStyle: React.CSSProperties = { color: '#7e8189' };
const dbTagStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 9,
  color: '#e26d6d',
  fontFamily: 'ui-monospace, monospace',
};
const truncStyle: React.CSSProperties = { color: '#ff7e7e', fontSize: 11 };
