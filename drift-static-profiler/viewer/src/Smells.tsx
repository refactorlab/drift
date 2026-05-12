import { TIPS } from './tooltips';
import { Help } from './Help';
import { ResizeHandle, useResizableColumns, type ColumnDef } from './useResizableColumns';
import type { CallTreeNode } from './types';

interface Props {
  root: CallTreeNode | null;
  onSelect: (node: CallTreeNode) => void;
}

interface Smell {
  node: CallTreeNode;
  kinds: ('n_plus_one_risk' | 'blocking_in_async' | 'is_recursive')[];
}

function collect(node: CallTreeNode, out: Smell[]) {
  const kinds: Smell['kinds'] = [];
  if (node.n_plus_one_risk) kinds.push('n_plus_one_risk');
  if (node.blocking_in_async) kinds.push('blocking_in_async');
  if (node.is_recursive) kinds.push('is_recursive');
  if (kinds.length) out.push({ node, kinds });
  for (const c of node.children) collect(c, out);
}

const KIND_META = {
  n_plus_one_risk: { label: 'N+1 RISK', color: '#e26d6d', detail: TIPS.smell_n_plus_one },
  blocking_in_async: { label: 'BLOCKING IN ASYNC', color: '#ff7e7e', detail: TIPS.smell_blocking },
  is_recursive: { label: 'RECURSIVE', color: '#d09bd1', detail: TIPS.smell_recursive },
};

// `<colgroup>` + `tableLayout: fixed` is how a real HTML table accepts
// per-column widths. The evidence column gets the lion's share by
// default since it wraps to multi-line.
const COLUMNS: ColumnDef[] = [
  { id: 'smell',    defaultWidth: 170, minWidth: 100 },
  { id: 'symbol',   defaultWidth: 260, minWidth: 100 },
  { id: 'location', defaultWidth: 190, minWidth: 90 },
  { id: 'evidence', defaultWidth: 520, minWidth: 150 },
];

export function Smells({ root, onSelect }: Props) {
  const cols = useResizableColumns('drift.smells.cols', COLUMNS);
  const w = cols.widths;
  if (!root) return null;
  const items: Smell[] = [];
  collect(root, items);

  if (items.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ marginBottom: 6 }}>✓ no smells detected in this entry's subtree</div>
        <div style={{ color: '#7e8189', fontSize: 11 }}>
          (analyzer looked for: N+1 queries, blocking I/O in async, mutual recursion)
        </div>
      </div>
    );
  }

  const headerCell = (id: string, label: string, tip: string) => (
    <th style={{ ...thStyle, position: 'relative', width: w[id] }}>
      <Help text={tip}>{label}</Help>
      <ResizeHandle onMouseDown={cols.startResize(id)} onReset={() => cols.resetColumn(id)} />
    </th>
  );

  return (
    <div style={containerStyle}>
      <div style={summaryRowStyle}>
        Found <strong>{items.length}</strong> symbol(s) with smells. Click a row to inspect.
        <Help text="Each row is one antipattern detected in the entry's subtree. Hover the smell badge for the definition + how to fix it." />{' '}
        <span style={{ color: '#5f626a' }}>· drag column edges to resize</span>
      </div>
      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: w.smell }} />
          <col style={{ width: w.symbol }} />
          <col style={{ width: w.location }} />
          <col style={{ width: w.evidence }} />
        </colgroup>
        <thead>
          <tr style={theadStyle}>
            {headerCell('smell', 'smell', TIPS.smells_col_smell)}
            {headerCell('symbol', 'symbol', TIPS.smells_col_symbol)}
            {headerCell('location', 'location', TIPS.smells_col_location)}
            {headerCell('evidence', 'evidence', TIPS.smells_col_evidence)}
          </tr>
        </thead>
        <tbody>
          {items.flatMap((s) =>
            s.kinds.map((kind) => (
              <tr
                key={`${s.node.id}:${kind}`}
                style={trStyle}
                onClick={() => onSelect(s.node)}
              >
                <td style={tdStyle}>
                  <span
                    style={{ ...badgeStyle, background: KIND_META[kind].color, cursor: 'help' }}
                    title={KIND_META[kind].detail}
                  >
                    {KIND_META[kind].label}
                  </span>
                </td>
                <td style={tdStyle}>
                  <code style={codeStyle}>
                    {s.node.parent_class ? `${s.node.parent_class}.` : ''}
                    {s.node.name}
                  </code>
                </td>
                <td style={tdLocStyle}>
                  {s.node.file}:{s.node.line}
                </td>
                <td style={tdEvidenceStyle}>
                  {evidenceFor(kind, s.node)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function evidenceFor(kind: Smell['kinds'][number], node: CallTreeNode): string {
  switch (kind) {
    case 'n_plus_one_risk': {
      const inLoopCalls = (node.external_calls || []).filter((e) => e.in_loop);
      if (inLoopCalls.length === 0) return 'category-reaching call inside a loop';
      return `${inLoopCalls.length} in-loop call(s): ${inLoopCalls.map((c) => `${c.receiver ? c.receiver + '.' : ''}${c.name}() @ :${c.line}`).join(', ')}`;
    }
    case 'blocking_in_async': {
      const blockers = (node.external_calls || []).filter(
        (e) => !e.in_await && (e.category === 'db' || e.category === 'network' || e.category === 'io'),
      );
      if (blockers.length === 0) return 'sync I/O call in async body without await';
      return `${blockers.length} non-awaited I/O call(s): ${blockers.map((c) => `${c.receiver ? c.receiver + '.' : ''}${c.name}() [${c.category}] @ :${c.line}`).join(', ')}`;
    }
    case 'is_recursive':
      return `symbol participates in a cycle (SCC size > 1)`;
  }
}

const containerStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'auto',
  padding: 12,
  fontSize: 12,
  background: '#1e1f22',
};
const summaryRowStyle: React.CSSProperties = {
  marginBottom: 12, color: '#9ca0a8', fontSize: 12,
};
const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  width: 'max-content',
  minWidth: '100%',
  fontFamily: 'ui-monospace, monospace',
};
const theadStyle: React.CSSProperties = {
  background: '#26282c',
  color: '#9ca0a8',
  textTransform: 'uppercase',
  fontSize: 10,
  letterSpacing: 0.4,
};
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid #3f4147',
  fontWeight: 700,
  boxSizing: 'border-box',
};
const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #2f3136',
  cursor: 'pointer',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  verticalAlign: 'top',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  boxSizing: 'border-box',
};
const tdLocStyle: React.CSSProperties = { ...tdStyle, color: '#7e8189', fontSize: 11, whiteSpace: 'nowrap' };
const tdEvidenceStyle: React.CSSProperties = {
  ...tdStyle,
  color: '#d7d9dc',
  fontSize: 11,
  whiteSpace: 'normal',  // evidence wraps to multi-line
  wordBreak: 'break-word',
};
const codeStyle: React.CSSProperties = { background: '#26282c', padding: '2px 5px', borderRadius: 3, color: '#d7d9dc' };
const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 7px',
  borderRadius: 3,
  color: '#0a0a14',
  fontSize: 10,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
const emptyStyle: React.CSSProperties = {
  padding: 20, color: '#d7d9dc', fontSize: 13,
};
