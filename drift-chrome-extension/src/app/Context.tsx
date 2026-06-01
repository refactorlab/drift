import { useState } from 'react';
import { usePrContext } from '../state/prContext';
import { ReportView } from '../ui/ReportView';
import { ArtifactFile } from './ArtifactFile';

// Full-screen view of the context saved for this PR: the downloaded source
// files and the loaded report. Everything here is scoped to the PR's URL.
export function Context({ onBack }: { onBack: () => void }) {
  const { ctx, clear } = usePrContext();
  // Bumped after a clear to remount the file cards (drop their in-memory state).
  const [nonce, setNonce] = useState(0);

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
          <ArtifactFile key={`${a.name}:${nonce}`} artifact={a} />
        ))}

        <div className="section-title">Loaded report</div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Parsed from the PR comment and attached to the chat as grounding.
        </div>
        <ReportView report={report} />
      </div>
    </div>
  );
}
