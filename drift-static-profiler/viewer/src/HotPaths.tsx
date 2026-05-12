import { CATEGORY_COLORS } from './types';
import { TIPS } from './tooltips';
import { Help } from './Help';
import { ResizeHandle, useResizableColumns, type ColumnDef } from './useResizableColumns';
import type { Category, HotPath } from './types';

interface Props {
  paths: HotPath[];
  onJump?: (frame: string) => void;
}

const COLUMNS: ColumnDef[] = [
  { id: 'category', defaultWidth: 90,  minWidth: 60 },
  { id: 'depth',    defaultWidth: 80,  minWidth: 50 },
  { id: 'path',     defaultWidth: 700, minWidth: 200 },
];

export function HotPaths({ paths, onJump }: Props) {
  const cols = useResizableColumns('drift.hotPaths.cols', COLUMNS);
  const w = cols.widths;

  if (paths.length === 0) {
    return (
      <div style={{ padding: 12, color: '#6e717a', fontStyle: 'italic', fontSize: 12 }}>
        no hot paths — analyzer didn't reach any classified resource calls.
      </div>
    );
  }
  return (
    <div style={containerStyle}>
      <div style={hintStyle}>
        {TIPS.hot_path} <Help text={TIPS.hot_path} /> <span style={{ color: '#5f626a' }}>· drag column edges to resize</span>
      </div>
      <div style={tableWrap}>
        <div style={headerRowStyle}>
          <span style={{ ...headerCellStyle, width: w.category, position: 'relative' }}>
            <Help text={TIPS.hot_col_category}>category</Help>
            <ResizeHandle onMouseDown={cols.startResize('category')} onReset={() => cols.resetColumn('category')} />
          </span>
          <span style={{ ...headerCellStyle, width: w.depth, position: 'relative' }}>
            <Help text={TIPS.hot_col_depth}>depth</Help>
            <ResizeHandle onMouseDown={cols.startResize('depth')} onReset={() => cols.resetColumn('depth')} />
          </span>
          <span style={{ ...headerCellStyle, width: w.path, position: 'relative' }}>
            <Help text={TIPS.hot_col_frames}>path (root → … → terminal)</Help>
            <ResizeHandle onMouseDown={cols.startResize('path')} onReset={() => cols.resetColumn('path')} />
          </span>
        </div>
        {paths.map((p, i) => (
          <div key={i} style={pathStyle}>
            <span style={{ width: w.category, display: 'flex', alignItems: 'center' }}>
              <span
                style={badgeStyle(CATEGORY_COLORS[p.terminal_category as Category])}
                title={`${TIPS.terminal_category}\n\n${TIPS[`category_${p.terminal_category}`] ?? ''}`}
              >
                {p.terminal_category}
              </span>
            </span>
            <span style={{ ...depthStyle, width: w.depth }} title={TIPS.hot_path_depth}>depth {p.depth}</span>
            <span style={{ ...framesStyle, width: w.path, overflow: 'hidden' }}>
              {p.frames.map((f, j) => (
                <span key={j}>
                  <code
                    style={onJump ? frameClickableStyle : frameStyle}
                    onClick={() => onJump?.(f)}
                    title={onJump ? `Click to jump to ${f} in the call tree / Details pane.` : undefined}
                  >
                    {f}
                  </code>
                  {j < p.frames.length - 1 && <span style={arrowStyle}> → </span>}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '8px 12px',
  overflow: 'auto',
  fontSize: 12,
};
const tableWrap: React.CSSProperties = {
  width: 'fit-content',
  minWidth: '100%',
};
const pathStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  borderBottom: '1px solid #2f3136',
  width: 'fit-content',
  minWidth: '100%',
};
const badgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 3,
  background: color,
  color: '#0a0a14',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  textAlign: 'center',
});
const depthStyle: React.CSSProperties = { color: '#7e8189', fontSize: 11 };
const framesStyle: React.CSSProperties = { color: '#d7d9dc', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' };
const frameStyle: React.CSSProperties = { background: '#2f3136', padding: '1px 5px', borderRadius: 2, color: '#d7d9dc' };
const frameClickableStyle: React.CSSProperties = {
  ...frameStyle,
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: '#5b8def',
  textUnderlineOffset: 2,
};
const hintStyle: React.CSSProperties = {
  color: '#6e717a', fontSize: 10, fontStyle: 'italic', marginBottom: 6,
};
const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0 6px 0',
  borderBottom: '1px solid #3f4147',
  marginBottom: 4,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#9ca0a8',
  fontWeight: 700,
  width: 'fit-content',
  minWidth: '100%',
};
const headerCellStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  // Breathing room from the column-divider line on the right edge.
  paddingRight: 10,
};
const arrowStyle: React.CSSProperties = { color: '#6e717a', margin: '0 4px' };
