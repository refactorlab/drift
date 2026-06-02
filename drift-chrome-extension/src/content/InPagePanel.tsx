// The in-page overlay: a floating launcher pill plus a slide-in panel that
// renders the live report. Lives inside a Shadow DOM so neither GitHub's CSS
// nor ours leak across the boundary.

import { useEffect, useState } from 'react';
import type { ArtifactRef, DriftReport } from '../core/types';
import { ReportView } from '../ui/ReportView';
import { sendToRuntime } from '../core/messaging';
import { getStoredArtifact, loadArtifact } from '../state/artifacts';
import { scanToReport, enrichWithScan } from '../core/scanReport';

export function InPagePanel({
  report,
  artifacts = [],
  hasAudio = false,
}: {
  report: DriftReport;
  /** Scan-artifact refs parsed from the comment; downloadable ones have a URL. */
  artifacts?: ArtifactRef[];
  /** Whether the comment linked a spoken-summary audio artifact. */
  hasAudio?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Load state for the REAL scan (pr-scan.json) that powers the full dashboard.
  type Phase = 'idle' | 'loading' | 'ready' | 'error';
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanReport, setScanReport] = useState<DriftReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only count scans we can actually pull (the comment linked a real upload).
  const scans = artifacts.filter((a) => a.url);
  const scanRef = scans.find((a) => a.kind === 'scan-report');

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset when the PR changes (SPA navigation reuses this component instance),
  // so we never show one PR's full scan on another's comment.
  useEffect(() => {
    setPhase('idle');
    setScanReport(null);
    setLoadError(null);
  }, [report.prUrl]);

  // Download pr-scan.json (via the user's GitHub session), map it into the full
  // dashboard model, and swap it in. Uses the same `drift:artifact:<url>` cache
  // the side panel reads, so a file opened here is already loaded there.
  async function loadScan() {
    if (!scanRef?.url) return;
    setPhase('loading');
    setLoadError(null);
    try {
      const cached = await getStoredArtifact(scanRef.url);
      const res = cached ? { ok: true as const, rec: cached } : await loadArtifact(scanRef);
      if (!res.ok) throw new Error(res.error);
      const mapped = scanToReport(JSON.parse(res.rec.content), report.prUrl);
      if (!mapped) throw new Error('unrecognised scan format');
      setScanReport(mapped); // full Complexity & Risk Report — all params from the JSON
      setPhase('ready');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'download failed');
      setPhase('error');
    }
    // Warm scan-context silently so the side panel has it cached too.
    const ctxRef = scans.find((a) => a.kind === 'scan-context');
    if (ctxRef?.url) {
      const url = ctxRef.url;
      void (async () => {
        if (!(await getStoredArtifact(url))) await loadArtifact(ctxRef);
      })();
    }
  }

  // Auto-load the full scan whenever the lens is open and we haven't yet. As an
  // effect (not a click handler) this also re-triggers if the PR changes while
  // the drawer stays open — the reset effect above flips phase back to 'idle'.
  useEffect(() => {
    if (open && phase === 'idle' && scanRef?.url) void loadScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, scanRef?.url]);

  if (!report.found) return null;

  // Keep the comment's authoritative headline, graft the scan's full sections
  // (the 18 Complexity & Risk params) — see enrichWithScan for the rationale.
  const view = enrichWithScan(report, scanReport);
  const crit = view.criticalCount ?? 0;
  const mc = view.mergeConfidence;
  const enriched = view !== report;

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
        {/* Notify that machine-readable scans (and/or audio) were detected. */}
        {scans.length > 0 && (
          <span className="drift-launcher-files" title={`${scans.length} scan file(s) detected`}>
            📎{scans.length}
          </span>
        )}
        {hasAudio && (
          <span className="drift-launcher-audio" title="Spoken summary available" aria-hidden>
            🔊
          </span>
        )}
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
            {phase === 'loading' && !scanReport && (
              <div className="drift-loading">
                <span className="drift-spin" />
                Downloading full scan (pr-scan.json)…
              </div>
            )}
            {phase === 'error' && !scanReport && (
              <div className="drift-loadfail">
                ⚠ Couldn’t load the full scan{loadError ? ` (${loadError})` : ''}. Showing the
                comment values.{' '}
                <button className="drift-linkbtn" onClick={() => void loadScan()}>
                  Retry
                </button>
              </div>
            )}
            <ReportView report={view} />
          </div>
          {report.prUrl && (
            <footer className="drift-footer">
              {enriched
                ? 'Complexity & Risk from pr-scan.json'
                : phase === 'loading'
                  ? 'Loading full scan…'
                  : 'From the PR comment'}{' '}
              ·{' '}
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
