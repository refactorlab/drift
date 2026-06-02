import { useState } from 'react';
import { usePrContext } from '../state/prContext';
import { ReportView } from '../ui/ReportView';
import { ArtifactFile } from './ArtifactFile';
import { loadArtifact } from '../state/artifacts';
import { scanToReport } from '../core/scanReport';
import type { DriftReport } from '../core/types';

type ScanState = 'idle' | 'loading' | 'error';

// Full-screen view of the context saved for this PR: the downloaded source
// files and the dashboard — rendered from the PR comment (instant) or from the
// REAL downloaded scan file (pr-scan.json), in the same UI.
export function Context({ onBack }: { onBack: () => void }) {
  const { ctx, clear } = usePrContext();
  const [nonce, setNonce] = useState(0);
  const [source, setSource] = useState<'comment' | 'scan'>('comment');
  const [scanReport, setScanReport] = useState<DriftReport | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState<string | null>(null);

  if (!ctx) {
    return (
      <div className="drift-app drift-root">
        <header className="app-bar">
          <button className="iconbtn" title="Back" onClick={onBack}>
            ←
          </button>
          <h1>Context</h1>
        </header>
        <div className="drift-empty">
          <div className="big">📎</div>
          No context loaded. Open a pull request that has a Drift comment.
        </div>
      </div>
    );
  }

  const { pr, report, artifacts } = ctx;
  const scanArtifact = artifacts.find((a) => a.kind === 'scan-report' && a.url);

  // Download the real pr-scan.json and map it into the dashboard model.
  async function loadFromScan() {
    if (!scanArtifact) {
      setScanError('No pr-scan.json linked on this PR');
      setScanState('error');
      return;
    }
    setScanState('loading');
    setScanError(null);
    const res = await loadArtifact(scanArtifact);
    if (!res.ok) {
      setScanError(res.error);
      setScanState('error');
      return;
    }
    try {
      const mapped = scanToReport(JSON.parse(res.rec.content), pr.url);
      if (!mapped) {
        setScanError('Not a recognised scan file');
        setScanState('error');
        return;
      }
      setScanReport(mapped);
      setScanState('idle');
    } catch {
      setScanError('Downloaded file is not valid JSON');
      setScanState('error');
    }
  }

  function chooseScan() {
    setSource('scan');
    if (!scanReport && scanState !== 'loading') void loadFromScan();
  }

  const shown = source === 'scan' && scanReport ? scanReport : report;

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <button className="iconbtn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Context</h1>
        <span className="spacer" />
        <button
          className="btn ghost danger"
          title="Delete the downloaded files + saved report for this PR"
          onClick={() => {
            void clear();
            setScanReport(null);
            setSource('comment');
            setNonce((n) => n + 1);
          }}
        >
          🗑 Clear
        </button>
      </header>

      <div className="settings">
        <div className="section-title">Pull request</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            {pr.title && <div className="label">{pr.title}</div>}
            <div className="hint">
              {pr.owner}/{pr.repo} · #{pr.number}
            </div>
          </div>
          <a className="btn ghost" href={pr.url} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>

        <div className="section-title">
          Sources · {artifacts.length} JSON file{artifacts.length === 1 ? '' : 's'}
        </div>
        {artifacts.length === 0 && (
          <div className="row">
            <div className="hint">No JSON artifacts linked on this PR.</div>
          </div>
        )}
        {artifacts.map((a) => (
          <ArtifactFile key={`${a.url ?? a.name}:${nonce}`} artifact={a} />
        ))}

        <div className="section-title">Dashboard</div>
        <div className="source-toggle">
          <button data-on={source === 'comment'} onClick={() => setSource('comment')}>
            From comment
          </button>
          <button
            data-on={source === 'scan'}
            onClick={chooseScan}
            disabled={!scanArtifact}
            title={scanArtifact ? 'Load from the real pr-scan.json' : 'No pr-scan.json linked'}
          >
            {scanState === 'loading' ? 'Loading…' : 'From scan file'}
          </button>
        </div>

        {source === 'scan' && scanState === 'loading' && (
          <div className="downloading">
            <span className="spinner" />
            <span>Downloading pr-scan.json and reading the real scan…</span>
          </div>
        )}
        {source === 'scan' && scanState === 'error' && (
          <div className="dl-strip warn">
            ⚠ Couldn’t load the scan ({scanError}).{' '}
            <button className="dl-saveas" onClick={() => void loadFromScan()}>
              Try again
            </button>
          </div>
        )}
        <div className="hint" style={{ margin: '4px 0 10px' }}>
          {source === 'scan' && scanReport
            ? 'Real values from the downloaded pr-scan.json.'
            : 'Parsed from the PR comment (quick view).'}
        </div>

        <ReportView report={shown} />
      </div>
    </div>
  );
}
