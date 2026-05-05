import type { Gate, Scan, TimeDistRow, TraceSpan } from '../types';
import { triggerAutofix } from '../api';
import {
  ActivityIcon,
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  CpuIcon,
  DbIcon,
  AlertIcon,
  NetworkIcon,
  XIcon,
} from './icons';

function ActionCard({ scan, prNumber }: { scan: Scan; prNumber: number }) {
  const onClick = async () => {
    try {
      const r = await triggerAutofix(prNumber);
      alert(r.message);
    } catch (e) {
      alert(`Failed to trigger autofix: ${(e as Error).message}`);
    }
  };
  return (
    <div className="card action-card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        <BoltIcon width={16} height={16} />
        AI Auto-fix Available
      </div>
      <div className="summary-text">
        Drift can generate a single PR fixing {scan.autofix.fixable} of{' '}
        {scan.autofix.total} issues. Estimated combined improvement:{' '}
        <strong style={{ color: 'var(--success)' }}>
          −{scan.autofix.savingsMs}ms P95
        </strong>
        .
      </div>
      <button className="btn primary" onClick={onClick}>
        <BoltIcon width={14} height={14} />
        Generate fix PR
      </button>
      <button className="btn secondary">View full report</button>
    </div>
  );
}

function GateRow({ gate }: { gate: Gate }) {
  const Icon =
    gate.status === 'pass' ? CheckIcon : gate.status === 'warn' ? AlertIcon : XIcon;
  return (
    <div className="check-item">
      <div className={`check-icon ${gate.status}`}>
        <Icon />
      </div>
      <span className="check-name">{gate.name}</span>
      <span className="check-val">{gate.value}</span>
    </div>
  );
}

const RES_ICON: Record<string, typeof DbIcon> = {
  Database: DbIcon,
  CPU: CpuIcon,
  'I/O Wait': ActivityIcon,
  Network: NetworkIcon,
  Cache: CheckCircleIcon,
};

function TimeDist({ rows }: { rows: TimeDistRow[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Time Distribution</div>
      </div>
      {rows.map((r) => {
        const Icon = RES_ICON[r.name] ?? DbIcon;
        return (
          <div key={r.name} className="resource">
            <div className="resource-head">
              <div className="resource-name">
                <Icon />
                {r.name}
              </div>
              <div className="resource-val">{r.pct}%</div>
            </div>
            <div className="bar">
              <div className={`bar-fill ${r.level}`} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Trace({ spans }: { spans: TraceSpan[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Sample Request Trace</div>
      </div>
      <div className="timeline">
        {spans.map((s) => (
          <div key={s.label} className="timeline-row">
            <span className="timeline-label">{s.label}</span>
            <div className="timeline-bar-container">
              <div
                className={`timeline-bar ${s.kind}`}
                style={{ left: `${s.offset_pct}%`, width: `${s.width_pct}%` }}
              />
            </div>
            <span className="timeline-time">{s.time_ms}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  prNumber,
  scan,
  gates,
  timeDistribution,
  trace,
}: {
  prNumber: number;
  scan: Scan;
  gates: Gate[];
  timeDistribution: TimeDistRow[];
  trace: TraceSpan[];
}) {
  return (
    <div className="sidebar">
      <ActionCard scan={scan} prNumber={prNumber} />
      <div className="card">
        <div className="card-header">
          <div className="card-title">Performance Gates</div>
        </div>
        {gates.map((g) => (
          <GateRow key={g.name} gate={g} />
        ))}
      </div>
      <TimeDist rows={timeDistribution} />
      <Trace spans={trace} />
    </div>
  );
}
