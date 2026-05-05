import { useState } from 'react';
import type { FlameRow, FlameAxis } from '../types';
import { FlameIcon } from './icons';

const TABS = ['CPU', 'Memory', 'I/O Wait', 'Allocations'] as const;

export function FlameGraph({
  rows,
  axis,
}: {
  rows: FlameRow[];
  axis: FlameAxis[];
}) {
  const [active, setActive] = useState<typeof TABS[number]>('CPU');
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FlameIcon width={16} height={16} />
          CPU Flame Graph
        </div>
        <div className="tab-row">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab${active === t ? ' active' : ''}`}
              onClick={() => setActive(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flamegraph">
        {rows.map((row) => (
          <div key={row.depth} className="flame-row">
            {row.blocks.map((b, i) => (
              <div
                key={i}
                className={`flame-block ${b.heat}`}
                style={{ flex: b.flex }}
                title={b.label || ''}
              >
                {b.label}
                {b.pct != null && <span className="pct">{b.pct}%</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="flame-axis">
          {axis.map((a, i) => (
            <span
              key={i}
              className="flame-axis-label"
              style={
                a.offset_pct === 100
                  ? { right: 0 }
                  : { left: `${a.offset_pct}%` }
              }
            >
              {a.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
