import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { ScanResponse } from '../types';
import { fetchScan } from '../api';
import { Layout } from '../components/Layout';
import { PRHeader } from '../components/PRHeader';
import { StatsGrid } from '../components/StatsGrid';
import { FlameGraph } from '../components/FlameGraph';
import { IssueList } from '../components/IssueList';
import { Sidebar } from '../components/Sidebar';

export default function ScanReportPage() {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null); setError(null);
    const num = Number(prNumber);
    if (!Number.isFinite(num)) {
      setError('Invalid PR number');
      return;
    }
    fetchScan(num)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [prNumber]);

  if (error) {
    return (
      <Layout>
        <div className="error">Error: {error}</div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn secondary" style={{ width: 'auto' }} onClick={() => navigate('/scans')}>
            ← Back to scans
          </button>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="loading">Loading scan…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PRHeader pr={data.pr} scan={data.scan} />
      <StatsGrid stats={data.scan.stats} />
      <div className="layout">
        <div className="main">
          <FlameGraph rows={data.flame.rows} axis={data.flame.axis} />
          <IssueList issues={data.issues} />
          <div style={{ marginTop: 16 }}>
            <Link to="/scans" className="btn secondary" style={{ width: 'auto', display: 'inline-flex' }}>
              ← All scans
            </Link>
          </div>
        </div>
        <Sidebar
          prNumber={data.pr.number}
          scan={data.scan}
          gates={data.gates}
          timeDistribution={data.timeDistribution}
          trace={data.trace}
        />
      </div>
    </Layout>
  );
}
