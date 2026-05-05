import { useEffect, useState } from 'react';
import type { DepartmentListItem, RepoListItem } from '../types';
import { fetchDepartments, fetchRepos } from '../api';
import { Layout, PageHeader } from '../components/Layout';
import { RepoIcon } from '../components/icons';

const fmtUSD = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<RepoListItem[] | null>(null);
  const [depts, setDepts] = useState<DepartmentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepos().then(setRepos).catch((e: Error) => setError(e.message));
    fetchDepartments().then(setDepts).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Layout><div className="error">Error: {error}</div></Layout>;
  if (!repos || !depts) return <Layout><div className="loading">Loading…</div></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Repositories"
        subtitle={`${repos.length} repositories across ${depts.length} departments`}
      />

      <div className="section-title">
        <span>Departments</span>
        <span className="section-title-sub">Rolled-up business value by org unit</span>
      </div>
      <table className="data-table" style={{ marginBottom: 32 }}>
        <thead>
          <tr>
            <th>Department</th>
            <th>Repos</th>
            <th>PRs</th>
            <th>Total business value</th>
            <th>Hours saved</th>
          </tr>
        </thead>
        <tbody>
          {depts.map((d) => (
            <tr key={d.id}>
              <td><strong>{d.name}</strong></td>
              <td className="cell-num dim">{d.repoCount}</td>
              <td className="cell-num dim">{d.prCount}</td>
              <td className="cell-num bv">{fmtUSD(d.totalBusinessValue)}</td>
              <td className="cell-num hours">{d.totalHoursSaved}h</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">
        <span>Repositories</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Department</th>
            <th>PRs</th>
            <th>Business value</th>
            <th>Hours saved</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((r) => (
            <tr key={r.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RepoIcon width={14} height={14} style={{ color: 'var(--text-dim)' }} />
                  <strong>{r.owner}/{r.name}</strong>
                </div>
              </td>
              <td className="cell-num dim">{r.department?.name ?? '—'}</td>
              <td className="cell-num dim">{r.prCount}</td>
              <td className="cell-num bv">{fmtUSD(r.totalBusinessValue)}</td>
              <td className="cell-num hours">{r.totalHoursSaved}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
