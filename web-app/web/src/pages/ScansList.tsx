import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScanListItem } from '../types';
import { fetchScansList } from '../api';
import { Layout, PageHeader } from '../components/Layout';

function timeAgo(ts: number): string {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ScansListPage() {
  const [data, setData] = useState<ScanListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScansList().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Layout><div className="error">Error: {error}</div></Layout>;
  if (!data) return <Layout><div className="loading">Loading…</div></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Scans"
        subtitle={`Most recent scan per PR · ${data.length} total`}
      />
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>PR</th>
            <th>Repo</th>
            <th>Author</th>
            <th>P95 latency</th>
            <th>Cache hit</th>
            <th>CPU</th>
            <th>Profiled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => {
            const verdict = s.verdict.toLowerCase();
            const baselineDelta = Math.round(
              ((s.p95LatencyMs - s.p95BaselineMs) / s.p95BaselineMs) * 100,
            );
            return (
              <tr key={s.prNumber}>
                <td><span className={`pill ${verdict}`}>{s.verdict}</span></td>
                <td className="cell-improvement">
                  <div className="title">
                    <Link to={`/scans/${s.prNumber}`}>#{s.prNumber} {s.prTitle}</Link>
                  </div>
                  <div className="meta">
                    <span className={`pill ${s.prStatus}`}>{s.prStatus}</span>
                    <span>{s.verdictSub}</span>
                  </div>
                </td>
                <td className="cell-num dim">{s.repo.owner}/{s.repo.name}</td>
                <td className="cell-num dim">@{s.author}</td>
                <td className="cell-num">
                  {s.p95LatencyMs}ms
                  <div style={{ fontSize: 11, color: baselineDelta > 0 ? 'var(--critical)' : 'var(--success)' }}>
                    {baselineDelta > 0 ? '▲' : '▼'} {Math.abs(baselineDelta)}% vs {s.p95BaselineMs}ms
                  </div>
                </td>
                <td className="cell-num">{s.cacheHitRate}%</td>
                <td className="cell-num">{s.cpuPct}%</td>
                <td className="cell-num dim">{timeAgo(s.profiledAt)}</td>
                <td>
                  <Link to={`/scans/${s.prNumber}`} className="gh-link">view →</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Layout>
  );
}
