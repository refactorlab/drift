import type { ScanStats } from '../types';
import { AlertIcon, CpuIcon, DbIcon, CheckCircleIcon } from './icons';

function pctChange(value: number, baseline: number): number {
  if (baseline === 0) return 0;
  return Math.round(((value - baseline) / baseline) * 100);
}

export function StatsGrid({ stats }: { stats: ScanStats }) {
  const p95Delta = pctChange(stats.p95.value, stats.p95.baseline);
  const cpuDelta = pctChange(stats.cpu.value, stats.cpu.baseline);
  const cacheDelta = pctChange(stats.cache.hitRate, stats.cache.baseline);

  return (
    <div className="stats">
      <div className="stat-card critical">
        <div className="stat-label">
          <AlertIcon width={12} height={12} />
          P95 Latency
        </div>
        <div className="stat-value">{stats.p95.value}ms</div>
        <div className="stat-trend up">
          ▲ {p95Delta}% vs baseline ({stats.p95.baseline}ms)
        </div>
      </div>
      <div className="stat-card warning">
        <div className="stat-label">
          <CpuIcon width={12} height={12} />
          CPU Usage
        </div>
        <div className="stat-value">{stats.cpu.value}%</div>
        <div className="stat-trend up">▲ {cpuDelta}% vs baseline</div>
      </div>
      <div className="stat-card info">
        <div className="stat-label">
          <DbIcon width={12} height={12} />
          DB Queries
        </div>
        <div className="stat-value">{stats.db.queries.toLocaleString()}</div>
        <div className="stat-trend up">▲ N+1 detected (×{stats.db.nPlusOne})</div>
      </div>
      <div className="stat-card success">
        <div className="stat-label">
          <CheckCircleIcon width={12} height={12} />
          Cache Hit Rate
        </div>
        <div className="stat-value">{stats.cache.hitRate}%</div>
        <div className="stat-trend down">
          ▼ {Math.abs(cacheDelta)}% vs baseline ({stats.cache.baseline}%)
        </div>
      </div>
    </div>
  );
}
