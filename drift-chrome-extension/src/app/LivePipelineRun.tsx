import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivePr } from '../state/activePr';
import type { PrInput } from '../core/scanProvider';
import { fetchPrHead, fetchPrChangedFiles } from '../core/prDiff';
import { downloadArchive, type DownloadProgress } from '../core/githubZip';
import { scanInWorker } from '../core/scanWorkerClient';
import { loadScannerModule } from '../core/scannerStore';
import { scanToReport } from '../core/scanReport';
import { buildNarration, summaryLine, type LiveScanMeta } from '../core/liveSummary';
import type { DriftReport, PrContext } from '../core/types';
import { createTtsProvider, type PreparedAudio, type TtsProvider } from '../core/ttsProvider';
import { isTtsAvailable, loadKokoroRuntime } from '../core/ttsStore';
import { SpokenSummary } from './SpokenSummary';
import { ScanReportView } from './report/ScanReportView';
import { getSettings } from '../state/settings';
import {
  addScan,
  getHistoryForPr,
  removeScan,
  type ScanRecord,
} from '../state/scanHistory';
import { setLiveContext } from '../state/liveContext';

// "Drift Live Scan" — runs the Drift pipeline locally, in the extension, with
// NO AI and NO REST API: read the PR's head sha + changed files from GitHub's
// stable .patch/.diff endpoints (credentialed, private-repo safe) → download
// the HEAD tree zip → EXECUTE the static profiler (WASM) scan-pr → render the
// exact sticky PR comment via the action's renderer. Real source, real scan,
// every time — there is no sample/fixture path.
//
// Every successful run is saved to history (replayable without re-scanning) and
// published as the PR's chat grounding, so the result becomes a conversation.

async function loadWasmModule(): Promise<WebAssembly.Module> {
  const { scannerUrl } = await getSettings();
  return loadScannerModule(scannerUrl);
}

const SCAN_LABEL = 'Static drift profiler (WASM)';

type StepId = 'resolve' | 'download' | 'diff' | 'scan' | 'render' | 'audio';
type StepState = 'idle' | 'active' | 'done' | 'error';
type Step = {
  id: StepId;
  label: string;
  detail: string;
  state: StepState;
  note?: string;
  startedAt?: number;
  elapsedMs?: number;
};

const STEPS: Step[] = [
  { id: 'resolve', label: 'Resolve PR', detail: 'head sha + changed files (.patch/.diff)', state: 'idle' },
  { id: 'download', label: 'Download head zip', detail: 'PR head tree from github.com', state: 'idle' },
  { id: 'diff', label: 'Compute diff', detail: 'changed files · numstat', state: 'idle' },
  { id: 'scan', label: 'Run scan-pr', detail: 'static drift profiler (WASM) · no AI', state: 'idle' },
  { id: 'render', label: 'Build report', detail: 'native React · no markdown', state: 'idle' },
  { id: 'audio', label: 'Spoken summary', detail: 'Kokoro TTS · on-device · no AI', state: 'idle' },
];

function fmtMs(ms: number): string {
  if (ms < 950) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Relative "x ago" for history rows. Coarse on purpose — the row also shows the
// short sha, which is what disambiguates two scans of the same minute.
function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Turn a download progress tick into a step note.
function downloadNote(p: DownloadProgress): string {
  if (p.total && p.total > 0) {
    const pct = Math.min(100, Math.round((p.bytes / p.total) * 100));
    return `${p.phase} · ${fmtBytes(p.bytes)} / ${fmtBytes(p.total)} (${pct}%)`;
  }
  return p.bytes > 0 ? `${p.phase} · ${fmtBytes(p.bytes)}` : p.phase;
}

function StepRow({ step, now }: { step: Step; now: number }) {
  const icon = { idle: '○', active: '●', done: '✓', error: '✗' }[step.state];
  const elapsed =
    step.state === 'active' && step.startedAt ? now - step.startedAt : step.elapsedMs;
  return (
    <div className={`pl-step pl-${step.state}`}>
      <span className="pl-step-icon">{icon}</span>
      <div className="grow">
        <div className="pl-step-top">
          <span className="label">{step.label}</span>
          {elapsed != null && step.state !== 'idle' && (
            <span className="pl-step-time">{fmtMs(elapsed)}</span>
          )}
        </div>
        <div className="hint">{step.note ?? step.detail}</div>
      </div>
    </div>
  );
}

// A single resolved result — the live run or a replayed history record. The two
// paths render through the exact same UI so they never drift.
type Display = {
  report: DriftReport;
  meta: LiveScanMeta;
  narration: string;
  /** Raw scan-pr.json (ScanPrOutput) — the native React report renders from this. */
  scan: unknown;
  ts: number;
  durationMs: number | null;
  // Audio synthesized eagerly during the run → SpokenSummary plays it instantly.
  // Null for replayed history (the WAV isn't persisted) → SpokenSummary re-arms
  // it lazily on demand, exactly as before.
  audio: PreparedAudio | null;
};

function recordToDisplay(r: ScanRecord): Display {
  return {
    report: r.report,
    meta: { owner: r.owner, repo: r.repo, number: r.number, title: r.title, changedFiles: r.changedFiles },
    narration: r.narration,
    scan: r.scan,
    ts: r.ts,
    durationMs: r.durationMs,
    audio: null,
  };
}

function toLiveContext(d: Display): PrContext {
  const { owner = '', repo, number, title = null } = d.meta;
  const url = `https://github.com/${owner}/${repo}/pull/${number}`;
  return {
    pr: { owner, repo, number, title, url },
    report: d.report,
    artifacts: [],
    detectedAt: d.ts,
  };
}

export function LivePipelineRun({ onBack }: { onBack: () => void }) {
  const activePr = useActivePr();

  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Display | null>(null);
  const [viewing, setViewing] = useState<Display | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const runStartRef = useRef(0);
  // One Kokoro provider for the panel's lifetime: the worker + model load once
  // and every run's synthesis reuses them (mirrors SpokenSummary's lazy provider).
  const ttsProviderRef = useRef<TtsProvider | null>(null);

  const prUrl = activePr
    ? `https://github.com/${activePr.owner}/${activePr.repo}/pull/${activePr.number}`
    : null;

  // The result currently on screen: a replayed history record wins, else the
  // live run's output.
  const display = viewing ?? result;

  // A lightweight clock so the active step + total tick live while running.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const iv = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(iv);
  }, [running]);

  // Abort any in-flight run if the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Reset all per-run/per-PR state on PR switch, then load the new PR's history.
  // `result` is the live run's output and `viewing` a replayed record — both are
  // bound to the PREVIOUS PR, so leaving them set would render that PR's scan on
  // a different (often never-scanned) PR via `display = viewing ?? result`.
  useEffect(() => {
    // Cancel any run still streaming for the previous PR so it can't land its
    // result onto this one after the reset below.
    abortRef.current?.abort();
    setViewing(null);
    setResult(null);
    setError(null);
    setSteps(STEPS.map((s) => ({ ...s })));
    if (!prUrl) {
      setHistory([]);
      return;
    }
    let live = true;
    void getHistoryForPr(prUrl).then((h) => {
      if (live) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, [prUrl]);

  const patch = useCallback((id: StepId, p: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...p };
        if (p.state === 'active' && s.state !== 'active') next.startedAt = Date.now();
        if ((p.state === 'done' || p.state === 'error') && s.startedAt != null) {
          next.elapsedMs = Date.now() - s.startedAt;
        }
        return next;
      }),
    );
  }, []);

  // Pipeline step 6 — synthesize the spoken summary on-device with the SAME
  // Kokoro engine the action uses, so the audio is ready BEFORE the result shows
  // and the first "Listen" press plays instantly. Fail-soft: if the engine isn't
  // staged (or the toggle is off, or synthesis errors), we return null and the
  // step still completes — SpokenSummary then degrades to the system voice. Only
  // an abort is rethrown (so the outer run() handles it like any other step).
  const synthSpokenSummary = useCallback(
    async (text: string, sig: AbortSignal): Promise<PreparedAudio | null> => {
      patch('audio', { state: 'active', note: 'preparing voice…' });
      try {
        const { ttsEnabled, ttsUrl, ttsVoice } = await getSettings();
        if (ttsEnabled === false) {
          patch('audio', { state: 'done', note: 'spoken summary off' });
          return null;
        }
        if (!(await isTtsAvailable(ttsUrl))) {
          patch('audio', { state: 'done', note: 'engine not staged · system voice' });
          return null;
        }
        const provider = (ttsProviderRef.current ??= createTtsProvider(async () => {
          const { ttsUrl: u } = await getSettings();
          return loadKokoroRuntime(u);
        }));
        const res = await provider.synthesize({
          text,
          voice: ttsVoice,
          signal: sig,
          onProgress: (m) => patch('audio', { note: m }),
        });
        patch('audio', { state: 'done', note: `ready · ${res.durationSeconds.toFixed(1)}s · ${res.voice}` });
        return { wav: res.wav, voice: res.voice, durationSeconds: res.durationSeconds };
      } catch (e) {
        if (sig.aborted || (e as Error)?.name === 'AbortError') throw e;
        patch('audio', { state: 'done', note: 'synthesis failed · system voice' });
        return null;
      }
    },
    [patch],
  );

  const run = useCallback(async () => {
    if (!activePr) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    runStartRef.current = Date.now();
    setRunning(true);
    setError(null);
    setResult(null);
    setViewing(null);
    setSteps(STEPS.map((s) => ({ ...s })));
    const sig = ac.signal;
    const { owner, repo, number } = activePr;
    const url = `https://github.com/${owner}/${repo}/pull/${number}`;

    try {
      // 1. Resolve head sha + PR diff from the STABLE git endpoints (.patch /
      //    .diff) — credentialed, private-repo safe, no fragile DOM scrape.
      patch('resolve', { state: 'active' });
      const [head, diff] = await Promise.all([
        fetchPrHead(owner, repo, number, sig),
        fetchPrChangedFiles(owner, repo, number, sig),
      ]);
      const title = head.title ?? null;
      patch('resolve', {
        state: 'done',
        note: `head ${head.headSha.slice(0, 7)} · ${diff.changedPaths.length} changed file(s)`,
      });

      // 2. Download ONLY the HEAD tree (by sha) as raw zip bytes — the unzip is
      //    deferred to the worker so it never blocks this thread.
      patch('download', { state: 'active', note: 'fetching head tree…' });
      const zipBytes = await downloadArchive(
        owner, repo, head.headSha,
        (p) => patch('download', { note: downloadNote(p) }), sig,
      );
      patch('download', { state: 'done', note: `${fmtBytes(zipBytes.length)} downloaded` });

      // 3. Changed files came from the .diff (no base zip, no local tree diff).
      patch('diff', { state: 'active' });
      patch('diff', { state: 'done', note: `${diff.changedPaths.length} changed file(s)` });

      const pr: PrInput = {
        owner, repo, number, title: title ?? undefined,
        baseRef: '', headRef: '',
        baseSha: '', headSha: head.headSha,
        changedFiles: diff.changedPaths, diffStats: diff.diffStats,
      };

      // 4. Unzip + execute the scanner in a Web Worker (no AI). Both are single
      //    synchronous, uninterruptible calls; on the main thread they froze the
      //    panel for the whole run. Off-thread the page stays live — the clock
      //    ticks and the worker streams unzip/scan progress back here.
      patch('scan', { state: 'active', note: 'preparing scanner…' });
      const wasm = await loadWasmModule();
      const report = await scanInWorker(
        zipBytes, wasm,
        {
          changedFiles: pr.changedFiles,
          commits: pr.commits,
          diffStats: pr.diffStats,
          prTitle: pr.title,
          prBody: pr.body,
        },
        { signal: sig, onProgress: (p) => patch('scan', { note: p.message }) },
      );
      patch('scan', { state: 'done', note: SCAN_LABEL });

      // 5. The result is the raw scan-pr.json — the React report renders every
      //    section from it directly (no markdown, no action renderer).
      patch('render', { state: 'active' });
      const scan: unknown = report;
      patch('render', { state: 'done', note: 'native React report' });

      // Build the at-a-glance summary + spoken narration from the same report,
      // then persist it to history and publish it as the PR's chat grounding.
      const driftReport = scanToReport(report, url);
      if (driftReport) {
        const meta: LiveScanMeta = { owner, repo, number, title, changedFiles: diff.changedPaths.length };
        const narration = buildNarration(driftReport, meta);

        // 6. Synthesize the spoken summary eagerly (on-device Kokoro, no AI) so
        //    it's playable the instant the result appears. Fail-soft to null.
        const audio = narration
          ? await synthSpokenSummary(narration, sig)
          : (patch('audio', { state: 'done', note: 'no narration' }), null);

        const durationMs = Date.now() - runStartRef.current;
        const next: Display = { report: driftReport, meta, narration, scan, ts: Date.now(), durationMs, audio };
        setResult(next);

        const record: ScanRecord = {
          id: `${url}@${head.headSha}@${next.ts}`,
          url, owner, repo, number, title,
          sha: head.headSha,
          ts: next.ts,
          durationMs,
          caption: summaryLine(driftReport, meta),
          verdict: driftReport.verdict,
          verdictLabel: driftReport.verdictLabel,
          report: driftReport,
          scan,
          narration,
          changedFiles: diff.changedPaths.length,
        };
        const hist = await addScan(record);
        setHistory(hist.filter((r) => r.url === url));
        await setLiveContext(toLiveContext(next));
      } else {
        // No parseable quality block → no narration to speak. Mark the audio step
        // done and still show the comment (no history/chat).
        patch('audio', { state: 'done', note: 'no narration' });
        const durationMs = Date.now() - runStartRef.current;
        setResult({
          report: { found: true, verdict: 'unknown', verdictLabel: '', effortLabel: null, mergeConfidence: null, gauges: [], blastRadius: null, criticalCount: null, metricCount: null, sections: [], prUrl: url, scrapedAt: 0 },
          meta: { owner, repo, number, title, changedFiles: diff.changedPaths.length },
          narration: '',
          scan,
          ts: Date.now(),
          durationMs,
          audio: null,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'Aborted' && (e as Error)?.name !== 'AbortError') {
        setError(msg);
        setSteps((prev) =>
          prev.map((s) =>
            s.state === 'active'
              ? { ...s, state: 'error', note: msg, elapsedMs: s.startedAt ? Date.now() - s.startedAt : undefined }
              : s,
          ),
        );
      }
    } finally {
      setRunning(false);
    }
  }, [activePr, patch, synthSpokenSummary]);

  // "Discuss in chat" — publish this result as the PR's grounding and go back to
  // the chat, which picks it up and opens with a grounded reasoning turn.
  const discuss = useCallback(async () => {
    if (!display) return;
    await setLiveContext(toLiveContext(display));
    onBack();
  }, [display, onBack]);

  const openRecord = useCallback((r: ScanRecord) => {
    setViewing(recordToDisplay(r));
  }, []);

  const deleteRecord = useCallback(
    async (e: React.MouseEvent, r: ScanRecord) => {
      e.stopPropagation();
      const next = await removeScan(r.id);
      setHistory(next.filter((x) => x.url === r.url));
      setViewing((v) => (v && v.ts === r.ts ? null : v));
    },
    [],
  );

  const liveTotal = running ? now - runStartRef.current : display?.durationMs ?? null;

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <button className="iconbtn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Live scan</h1>
        {liveTotal != null && liveTotal > 0 && (
          <>
            <span className="spacer" />
            <span className="pl-total" title="Total run time">
              {fmtMs(liveTotal)}
            </span>
          </>
        )}
      </header>

      <div className="settings">
        <div className="section-title">Run the Drift pipeline here · no AI · no API</div>
        <div className="hint" style={{ margin: '0 0 10px' }}>
          Downloads the PR head tree, runs the static drift profiler’s{' '}
          <code>scan-pr</code> in WebAssembly, and renders a full native report —
          gauges, diagrams and all — right here. Every run is saved and becomes a
          chat you can ask about.
        </div>

        {activePr ? (
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <div className="grow">
              <div className="label">
                {activePr.owner}/{activePr.repo}
              </div>
              <div className="hint">Pull request #{activePr.number}</div>
            </div>
            {running ? (
              <button className="btn ghost danger" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button className="btn" onClick={() => void run()}>
                {history.length || result ? '↻ Re-run' : '▶ Run scan'}
              </button>
            )}
          </div>
        ) : (
          <div className="drift-empty">
            <div className="big">⚡</div>
            Open a GitHub pull request to scan it.
          </div>
        )}

        {activePr && running && (
          <>
            <div className="section-title">Steps</div>
            <div className="pl-steps">
              {steps.map((s) => (
                <StepRow key={s.id} step={s} now={now} />
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="dl-strip warn" style={{ marginTop: 10 }}>
            ⚠ {error}
          </div>
        )}

        {display && (
          <>
            <div className="pl-result-head">
              <div className="section-title" style={{ margin: 0 }}>
                {viewing ? 'Past scan' : 'Result'}
              </div>
              <div className="pl-result-actions">
                {viewing && (
                  <button className="pl-pill" onClick={() => setViewing(null)}>
                    ✕ Close
                  </button>
                )}
                <button className="pl-pill accent" onClick={() => void discuss()}>
                  💬 Discuss in chat
                </button>
              </div>
            </div>

            {display.narration && (
              <SpokenSummary text={display.narration} prepared={display.audio} />
            )}

            <ScanReportView scan={display.scan} />
          </>
        )}

        {activePr && history.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 18 }}>
              Recent scans · {history.length}
            </div>
            <div className="pl-history">
              {history.map((r) => {
                const active = viewing != null && viewing.ts === r.ts;
                return (
                  <button
                    key={r.id}
                    className={`pl-hist-row${active ? ' active' : ''}`}
                    onClick={() => openRecord(r)}
                    title={`Replay scan of ${r.sha.slice(0, 7)}`}
                  >
                    <span className={`pl-hist-dot pl-verdict-${r.verdict}`} />
                    <span className="grow">
                      <span className="pl-hist-caption">{r.caption}</span>
                      <span className="pl-hist-meta">
                        {fmtAgo(r.ts)} · {r.sha.slice(0, 7)} · {r.verdictLabel || 'Reviewed'}
                      </span>
                    </span>
                    <span
                      className="pl-hist-del"
                      role="button"
                      title="Delete this scan"
                      onClick={(e) => void deleteRecord(e, r)}
                    >
                      ✕
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
