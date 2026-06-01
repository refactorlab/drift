// The in-page overlay: a floating launcher pill plus a slide-in panel that
// renders the live report. Lives inside a Shadow DOM so neither GitHub's CSS
// nor ours leak across the boundary.

import { useEffect, useState } from 'react';
import type { DriftReport } from '../core/types';
import { ReportView } from '../ui/ReportView';
import { sendToRuntime } from '../core/messaging';

export function InPagePanel({ report }: { report: DriftReport }) {
  const [open, setOpen] = useState(false);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!report.found) return null;

  const crit = report.criticalCount ?? 0;
  const mc = report.mergeConfidence;

  return (
    <div className="drift-root">
      {/* Launcher */}
      <button
        className="drift-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Drift Lens — PR health"
      >
        <span className="drift-logo" />
        <span className="drift-launcher-text">
          {mc ? `Merge ${mc.value}/${mc.outOf}` : 'Drift'}
        </span>
        {crit > 0 && <span className="drift-launcher-badge">{crit}</span>}
      </button>

      {/* Slide-in panel */}
      <aside className={`drift-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drift-panel">
          <header className="drift-header">
            <span className="drift-logo" />
            <h1>Drift Lens</h1>
            <span className="drift-spacer" />
            <button
              className="drift-iconbtn"
              title="Open in side panel"
              onClick={() => void sendToRuntime({ type: 'OPEN_SIDE_PANEL' })}
            >
              ⇲
            </button>
            <button className="drift-iconbtn" title="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>
          <div className="drift-scroll">
            <ReportView report={report} />
          </div>
          {report.prUrl && (
            <footer className="drift-footer">
              Scraped from this PR ·{' '}
              <a href="https://github.com/marketplace/actions/andy-pr-handoff-by-drift" target="_blank" rel="noreferrer">
                What is Drift?
              </a>
            </footer>
          )}
        </div>
      </aside>
    </div>
  );
}
