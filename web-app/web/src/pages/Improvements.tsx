import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArchitectureSuggestion, ImprovementsResponse, ImprovementRow } from '../types';
import { fetchArchitectureSuggestions, fetchImprovements } from '../api';
import { Layout, PageHeader } from '../components/Layout';
import { ExternalIcon, BoltIcon, CheckCircleIcon } from '../components/icons';

const fmtUSD = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

function ImprovementsTable({ rows }: { rows: ImprovementRow[] }) {
  if (rows.length === 0) {
    return <div className="loading" style={{ minHeight: 120 }}>No improvements in this category.</div>;
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Improvement</th>
          <th>Repo total</th>
          <th>Dept total</th>
          <th>Company total</th>
          <th>Business value</th>
          <th>Eng. hours saved</th>
          <th>GitHub</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="cell-improvement">
              <div className="title">
                {r.scan ? (
                  <Link to={`/scans/${r.number}`}>#{r.number} {r.title}</Link>
                ) : (
                  <span>#{r.number} {r.title}</span>
                )}
                <span className={`pill ${r.status}`}>{r.status}</span>
              </div>
              {r.improvement && <div className="desc">{r.improvement}</div>}
              <div className="meta">
                <span>{r.repo.owner}/{r.repo.name}</span>
                {r.department && <span>· {r.department.name}</span>}
                <span>· @{r.author}</span>
              </div>
            </td>
            <td className="cell-num dim">{fmtUSD(r.rollups.repoTotal)}</td>
            <td className="cell-num dim">{fmtUSD(r.rollups.departmentTotal)}</td>
            <td className="cell-num dim">{fmtUSD(r.rollups.companyTotal)}</td>
            <td className="cell-num bv">{fmtUSD(r.businessValue)}</td>
            <td className="cell-num hours">{r.hoursSaved}h</td>
            <td>
              <a className="gh-link" href={r.githubUrl} target="_blank" rel="noreferrer">
                <ExternalIcon /> #{r.number}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArchitectureSection({ suggestions }: { suggestions: ArchitectureSuggestion[] }) {
  return (
    <>
      <div className="section-title" style={{ marginTop: 32 }}>
        <span>Architecture Improvement Suggestions · {suggestions.length}</span>
        <span className="section-title-sub">Large-scale system changes — sorted by business value</span>
      </div>
      <div className="arch-grid">
        {suggestions.map((s) => (
          <div key={s.id} className="arch-card">
            <div className="arch-head">
              <div>
                <div className="arch-title">{s.title}</div>
                <div className="arch-context">
                  {s.repo && <span>{s.repo.owner}/{s.repo.name}</span>}
                  {s.department && <span>· {s.department.name}</span>}
                </div>
              </div>
              <span className={`pill ${s.status}`}>{s.status}</span>
            </div>
            <div className="arch-desc">{s.description}</div>
            <div className="arch-meta">
              <span>Business value: <strong style={{ color: 'var(--success)' }}>{fmtUSD(s.businessValue)}</strong></span>
              <span>Eng. hours: <strong style={{ color: 'var(--info)' }}>{s.hoursSaved.toLocaleString()}h</strong></span>
              {s.githubUrl && (
                <a href={s.githubUrl} target="_blank" rel="noreferrer" className="gh-link" style={{ marginLeft: 'auto' }}>
                  <ExternalIcon /> Discussion
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ImprovementsPage() {
  const [data, setData] = useState<ImprovementsResponse | null>(null);
  const [arch, setArch] = useState<ArchitectureSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');

  useEffect(() => {
    fetchImprovements().then(setData).catch((e: Error) => setError(e.message));
    fetchArchitectureSuggestions().then(setArch).catch((e: Error) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return tab === 'pending' ? data.pending : data.approved;
  }, [data, tab]);

  if (error) return <Layout><div className="error">Error: {error}</div></Layout>;
  if (!data || !arch) return <Layout><div className="loading">Loading…</div></Layout>;

  const t = data.totals;

  return (
    <Layout>
      <PageHeader
        title="PR Improvements"
        subtitle="Track business value and engineering hours saved across all PR-driven improvements. Aggregations roll up: PR → Repo → Department → Company."
      />

      <div className="totals-strip">
        <div className="stat-card warning">
          <div className="stat-label"><BoltIcon width={12} height={12} /> Pending value</div>
          <div className="stat-value">{fmtUSD(t.pendingBusinessValue)}</div>
          <div className="stat-trend">{t.pendingCount} PRs · {t.pendingHoursSaved}h</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label"><CheckCircleIcon width={12} height={12} /> Approved value</div>
          <div className="stat-value">{fmtUSD(t.approvedBusinessValue)}</div>
          <div className="stat-trend">{t.approvedCount} PRs · {t.approvedHoursSaved}h</div>
        </div>
        <div className="stat-card info">
          <div className="stat-label">Company business value</div>
          <div className="stat-value">{fmtUSD(t.companyBusinessValue)}</div>
          <div className="stat-trend">all statuses combined</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Eng. hours saved</div>
          <div className="stat-value">{t.companyHoursSaved.toLocaleString()}</div>
          <div className="stat-trend">across {t.pendingCount + t.approvedCount} PRs</div>
        </div>
      </div>

      <div className="toplevel-tabs">
        <button
          className={`toplevel-tab${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pending Approval <span className="count">{t.pendingCount}</span>
        </button>
        <button
          className={`toplevel-tab${tab === 'approved' ? ' active' : ''}`}
          onClick={() => setTab('approved')}
        >
          Approved <span className="count">{t.approvedCount}</span>
        </button>
      </div>

      <ImprovementsTable rows={rows} />

      <ArchitectureSection suggestions={arch} />
    </Layout>
  );
}
