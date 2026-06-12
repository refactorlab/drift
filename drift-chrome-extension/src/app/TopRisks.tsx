import { useEffect, useRef, useState } from 'react';
import type { DriftReport } from '../core/types';
import {
  deriveTopRisks,
  summarizeRisksWithBrain,
  type TopRisk,
  type RiskSource,
} from '../core/riskSummary';

// The headline widget: the three most important risks, surfaced the instant a
// scan resolves. It paints the on-device ranking immediately (no spinner, no
// network), then quietly upgrades to Claude's one-liners when the local brain is
// reachable. The Claude result is cached per scan id, so replaying a past scan or
// flipping back to this view is instant and never re-asks the brain.

const claudeCache = new Map<string, TopRisk[]>();

/** Test-only: drop the cross-mount Claude cache. */
export function __resetRiskCache(): void {
  claudeCache.clear();
}

const SEV_LABEL: Record<NonNullable<TopRisk['severity']>, string> = {
  high: 'high',
  moderate: 'med',
  low: 'low',
};

export function TopRisks({
  scanId,
  scan,
  report,
  brainUrl,
  model,
}: {
  /** Stable scan-record id; keys the Claude cache. Empty disables caching. */
  scanId: string;
  scan: unknown;
  report: DriftReport;
  brainUrl?: string;
  model?: string;
}) {
  // The scan/report for the current scanId never change content, but a parent can
  // hand us new OBJECT identities on re-render. Hold them in refs so the brain
  // effect keys on the stable scanId alone and a re-render can't abort/restart an
  // in-flight stream (which would peg the badge on "analyzing…" forever).
  const scanRef = useRef(scan);
  scanRef.current = scan;
  const reportRef = useRef(report);
  reportRef.current = report;

  // Lazy initializer → deriveTopRisks runs ONCE on mount, not on every render.
  const [risks, setRisks] = useState<TopRisk[]>(
    () => (scanId ? claudeCache.get(scanId) : undefined) ?? deriveTopRisks(scan, report),
  );
  const [source, setSource] = useState<RiskSource>(
    scanId && claudeCache.has(scanId) ? 'claude' : 'scan',
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = scanId ? claudeCache.get(scanId) : undefined;
    if (c) {
      setRisks(c);
      setSource('claude');
      setLoading(false);
      return;
    }
    // Repaint the on-device ranking for THIS scan, then try to upgrade it.
    const scan = scanRef.current;
    const report = reportRef.current;
    setRisks(deriveTopRisks(scan, report));
    setSource('scan');
    const ac = new AbortController();
    setLoading(true);
    void summarizeRisksWithBrain({ scan, report, brainUrl, model, signal: ac.signal })
      .then((r) => {
        if (ac.signal.aborted || !r?.length) return;
        if (scanId) claudeCache.set(scanId, r);
        setRisks(r);
        setSource('claude');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [scanId, brainUrl, model]);

  const empty = risks.length === 0;

  return (
    <section className="tr-card" aria-label="Top risks">
      <div className="tr-head">
        <span className="tr-glyph">⚠</span>
        <span className="tr-title">Top risks</span>
        <span className={`tr-badge tr-badge-${source}`} title={
          source === 'claude'
            ? 'Summarized by Claude (local drift-brain)'
            : 'Ranked on-device from the scan'
        }>
          {loading ? 'analyzing…' : source === 'claude' ? '✦ Claude' : 'on-device'}
        </span>
      </div>

      {empty ? (
        <div className="tr-empty">No blocking risks flagged — this change looks clean.</div>
      ) : (
        <ol className="tr-list">
          {risks.map((r) => (
            <li key={r.rank} className="tr-item">
              <span className="tr-rank">{r.rank}</span>
              <span className="tr-body">
                <span className="tr-text">{r.text}</span>
                {(r.file || r.severity) && (
                  <span className="tr-meta">
                    {r.severity && (
                      <span className={`tr-sev tr-sev-${r.severity}`}>{SEV_LABEL[r.severity]}</span>
                    )}
                    {r.file && <span className="tr-file" title={r.file}>{r.file}</span>}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {source === 'scan' && !loading && (
        <div className="tr-hint" title="Run the local drift-brain (claude login) to get an AI risk summary">
          ⓘ Start drift-brain for an AI summary
        </div>
      )}
    </section>
  );
}
