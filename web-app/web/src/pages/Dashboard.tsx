import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardResponse } from '../types';
import { fetchDashboard } from '../api';
import { Layout, PageHeader } from '../components/Layout';
import { AlertIcon, CheckCircleIcon, BoltIcon, RepoIcon } from '../components/icons';

const fmtUSD = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Layout><div className="error">Error: {error}</div></Layout>;
  if (!data) return <Layout><div className="loading">Loading…</div></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        subtitle="Performance scans and improvement value across all repositories"
      />

      <div className="stats">
        <div className="stat-card critical">
          <div className="stat-label"><AlertIcon width={12} height={12} /> Failed scans</div>
          <div className="stat-value">{data.scans.failed}</div>
          <div className="stat-trend">
            of {data.scans.total} total · {data.scans.warn} warn · {data.scans.passed} pass
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label"><BoltIcon width={12} height={12} /> Pending improvements</div>
          <div className="stat-value">{data.improvements.pending}</div>
          <div className="stat-trend">
            {fmtUSD(data.improvements.pendingBusinessValue)} potential value
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-label"><CheckCircleIcon width={12} height={12} /> Approved improvements</div>
          <div className="stat-value">{data.improvements.approved}</div>
          <div className="stat-trend">
            {fmtUSD(data.improvements.approvedBusinessValue)} delivered
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-label"><BoltIcon width={12} height={12} /> Engineering hours saved</div>
          <div className="stat-value">{data.improvements.totalHoursSaved.toLocaleString()}</div>
          <div className="stat-trend">across {data.scans.total} scanned PRs</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Scans</div>
            <Link to="/scans" className="nav-link" style={{ textDecoration: 'none' }}>view all →</Link>
          </div>
          {data.recentScans.map((s) => {
            const verdict = s.verdict.toLowerCase();
            return (
              <div key={s.prNumber} className="dash-list-row">
                <span className={`pill ${verdict}`}>{s.verdict}</span>
                <div className="grow">
                  <div className="pr-line">
                    <Link to={`/scans/${s.prNumber}`}>
                      #{s.prNumber} {s.prTitle}
                    </Link>
                  </div>
                  <div className="pr-sub">
                    {s.repo.owner}/{s.repo.name} · @{s.author} · p95 {s.p95LatencyMs}ms
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Repos by Business Value</div>
            <Link to="/repositories" className="nav-link" style={{ textDecoration: 'none' }}>view all →</Link>
          </div>
          {data.topRepos.map((r) => (
            <div key={r.id} className="dash-list-row">
              <RepoIcon width={14} height={14} style={{ color: 'var(--text-dim)' }} />
              <div className="grow">
                <div className="pr-line">{r.owner}/{r.name}</div>
                <div className="pr-sub">{r.prCount} PRs scanned</div>
              </div>
              <span className="cell-num bv">{fmtUSD(r.totalBusinessValue)}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
