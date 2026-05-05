import { useEffect, useState } from 'react';
import type { ScanResponse } from './types';
import { fetchScan } from './api';
import { Nav } from './components/Nav';
import { PRHeader } from './components/PRHeader';
import { StatsGrid } from './components/StatsGrid';
import { FlameGraph } from './components/FlameGraph';
import { IssueList } from './components/IssueList';
import { Sidebar } from './components/Sidebar';

const PR_NUMBER = Number(new URLSearchParams(location.search).get('pr')) || 2847;

export default function App() {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScan(PR_NUMBER)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <>
        <Nav />
        <div className="error">Error: {error}</div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <div className="loading">Loading scan…</div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="container">
        <PRHeader pr={data.pr} scan={data.scan} />
        <StatsGrid stats={data.scan.stats} />
        <div className="layout">
          <div className="main">
            <FlameGraph rows={data.flame.rows} axis={data.flame.axis} />
            <IssueList issues={data.issues} />
          </div>
          <Sidebar
            prNumber={data.pr.number}
            scan={data.scan}
            gates={data.gates}
            timeDistribution={data.timeDistribution}
            trace={data.trace}
          />
        </div>
      </div>
    </>
  );
}
