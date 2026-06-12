import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivePr } from '../state/activePr';
import type { PrInput } from '../core/scanProvider';
import { fetchPrHead, fetchPrChangedFiles, fetchPrBody, type ChangedFileStatus } from '../core/prDiff';
import { downloadArchive, type DownloadProgress } from '../core/githubZip';
import { getCachedZipSize, setCachedZipSize } from '../core/downloadSizeEstimate';
import { scanInWorker } from '../core/scanWorkerClient';
import { loadScannerModule } from '../core/scannerStore';
import { scanToReport } from '../core/scanReport';
import { saveTextFile } from '../core/saveFile';
import { buildNarration, summaryLine, type LiveScanMeta } from '../core/liveSummary';
import type { DriftReport, PrContext } from '../core/types';
import type { PrDiff } from '../core/scanOutput';
import { buildReviewBrief } from '../core/reviewBrief';
import { type PreparedAudio } from '../core/ttsProvider';
import { getSharedTtsProvider } from '../core/ttsEngine';
import { isTtsAvailable } from '../core/ttsStore';
import { SpokenSummary } from './SpokenSummary';
import { TopRisks } from './TopRisks';
import { ScanReportView } from './report/ScanReportView';
import { ForceExpandContext } from './report/primitives';
import { getSettings, type Settings } from '../state/settings';
import { markAutoHandled, wasAutoHandled } from '../state/sessionScan';
import {
  addScan,
  getHistoryForPr,
  getPrGroups,
  removeScan,
  type PrGroup,
  type ScanRecord,
} from '../state/scanHistory';
import { openUrlInTab } from '../core/messaging';
import { setLiveContext } from '../state/liveContext';
import { saveSpokenAudio, getSpokenAudio, removeSpokenAudio } from '../state/spokenAudio';
// Inlined as strings (Vite `?inline`) so the HTML export can ship a fully
// self-contained file — same pattern the content script uses to sandbox its
// styles. theme.css holds the design tokens; app.css carries the dark-theme
// override + layout; report.css styles the `rp-*` report markup we snapshot.
import themeCss from '../ui/theme.css?inline';
import appCss from './app.css?inline';
import reportCss from './report/report.css?inline';

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
  // loadScannerModule reads settings itself to pick the cached (downloaded)
  // scanner over the bundled build.
  return loadScannerModule();
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

// Exported for unit testing the estimate marker + clamp logic below.
// Turn a download progress tick into a step note. When the total is estimated
// (codeload omits Content-Length, so we lean on a cached/API size) we prefix the
// total + percentage with `~` so the number reads as approximate, and never let
// a low estimate show less than the bytes already downloaded.
export function downloadNote(p: DownloadProgress): string {
  // Live speed is appended whenever known — it's the progress signal that keeps
  // a totalless first download from looking frozen.
  const speed = p.bytesPerSec ? ` · ${fmtBytes(p.bytesPerSec)}/s` : '';
  if (p.total && p.total > 0) {
    const total = p.estimated ? Math.max(p.total, p.bytes) : p.total;
    const pct = Math.min(100, Math.round((p.bytes / total) * 100));
    const approx = p.estimated ? '~' : '';
    return `${p.phase} · ${fmtBytes(p.bytes)} / ${approx}${fmtBytes(total)} (${approx}${pct}%)${speed}`;
  }
  return p.bytes > 0 ? `${p.phase} · ${fmtBytes(p.bytes)}${speed}` : p.phase;
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
  /** Scan-record id (`${url}@${sha}@${ts}`) — the storage key for this scan's
   *  spoken audio. Lets a lazily-synthesized clip be cached back to the right
   *  record. Empty for the no-narration display (which is never persisted). */
  id: string;
  report: DriftReport;
  meta: LiveScanMeta;
  narration: string;
  /** Raw scan-pr.json (ScanPrOutput) — the native React report renders from this. */
  scan: unknown;
  /** Per-file git status (the literal diff), reconstructed client-side from the
   *  unified .diff — drives the always-visible "Changed files" section. */
  changedStatus: ChangedFileStatus[];
  /** Full commit messages from the .patch — drives the Commits section. */
  commits: string[];
  /** Distinct commit-author display names — "who wrote the PR". */
  authors: string[];
  ts: number;
  durationMs: number | null;
  // Audio synthesized eagerly during the run → SpokenSummary plays it instantly.
  // Null for replayed history (the WAV isn't persisted) → SpokenSummary re-arms
  // it lazily on demand, exactly as before.
  audio: PreparedAudio | null;
};

// Stable, self-describing filename for an exported scan. Sanitises the repo
// coordinates so the result is filesystem-safe on every OS (no slashes, spaces
// or punctuation), e.g. `drift-scan-acme-web-pr1423.json`. Pure so it can be
// unit-tested without a DOM. `ext` switches the JSON vs HTML export.
export function scanExportFilename(meta: LiveScanMeta, ext: 'json' | 'html' = 'json'): string {
  const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const owner = slug(meta.owner ?? '');
  const repo = slug(meta.repo);
  const repoPart = [owner, repo].filter(Boolean).join('-') || 'scan';
  return `drift-scan-${repoPart}-pr${meta.number}.${ext}`;
}

// Attribute-safe escape (also handles quotes) — used for the <title>.
const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Text-content escape — the minimum a element/<pre> body needs. Leaves quotes
// intact so embedded JSON keeps its readable `"key"` form in the export source.
const escHtmlText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Frame a captured report body into a standalone, offline HTML document: the
// design tokens + report CSS are inlined, the live theme is pinned on <html>,
// and the body is wrapped in `.drift-root` so the tokens resolve exactly as they
// do in the panel. Pure (no DOM/Date) → unit-testable. The body is the report's
// live `outerHTML` (so scanner-rendered mermaid/gauge SVGs are already baked in).
export function buildScanHtmlDoc(opts: {
  title: string;
  theme: 'light' | 'dark';
  css: string;
  body: string;
}): string {
  const frame =
    'body.drift-root{margin:0;min-height:100vh;background:var(--drift-bg);color:var(--drift-fg)}' +
    '.drift-export{max-width:980px;margin:0 auto;padding:24px 20px}' +
    '.drift-export-head{padding:0 0 14px;margin:0 0 16px;border-bottom:1px solid var(--drift-border)}' +
    '.drift-export-head h1{font:600 18px/1.3 var(--drift-font);margin:0 0 4px}' +
    '.drift-export-head p{margin:0;color:var(--drift-fg-muted);font-size:12px}' +
    // The raw-JSON block renders in full (no max-height clamp) so the export is a
    // complete, self-contained record — wrapping long lines instead of truncating.
    '.drift-export-raw pre{margin:0;white-space:pre-wrap;word-break:break-word;' +
    'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--drift-bg);' +
    'border:1px solid var(--drift-border);border-radius:8px;padding:12px;overflow:auto}';
  return [
    '<!doctype html>',
    `<html lang="en" data-theme="${opts.theme}" style="color-scheme:${opts.theme}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escHtml(opts.title)}</title>`,
    `<style>${opts.css}</style>`,
    `<style>${frame}</style>`,
    '</head>',
    `<body class="drift-root"><main class="drift-export">${opts.body}</main></body>`,
    '</html>',
  ].join('\n');
}

// The complete raw scan-pr.json, pretty-printed and embedded as an HTML section.
// The rendered report above it is lossy by design — collapsed sections and
// truncated lists ("10 more suggestions", closed mindmaps) never reach the DOM —
// so this block is what makes the export a LOSSLESS record: every field of the
// ScanPrOutput, escaped so even string values containing markup stay literal.
export function buildRawJsonSection(scan: unknown): string {
  const json = JSON.stringify(scan, null, 2) ?? 'null';
  return (
    '<section class="rp-section drift-export-raw">' +
    '<header class="rp-section-head"><h3><span class="rp-section-icon">🧾</span>Raw scan-pr.json</h3>' +
    '<span class="rp-badge" style="color: var(--drift-fg-muted); border-color: var(--drift-fg-muted);">complete · lossless</span>' +
    `</header><pre>${escHtmlText(json)}</pre></section>`
  );
}

// The theme actually painted right now, resolving 'system' to a concrete value
// so the export isn't at the mercy of the reader's OS preference.
function resolveActiveTheme(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function recordToDisplay(r: ScanRecord): Display {
  return {
    id: r.id,
    report: r.report,
    meta: { owner: r.owner, repo: r.repo, number: r.number, title: r.title, changedFiles: r.changedFiles },
    narration: r.narration,
    scan: r.scan,
    changedStatus: r.changedStatus ?? [],
    commits: r.commits ?? [],
    authors: r.authors ?? [],
    ts: r.ts,
    durationMs: r.durationMs,
    audio: null,
  };
}

function toLiveContext(d: Display): PrContext {
  const { owner = '', repo, number, title = null } = d.meta;
  const url = `https://github.com/${owner}/${repo}/pull/${number}`;
  // The live scan injected `pr_diff` into the raw scan JSON (see the run loop);
  // carry it through so the voice agent grounds on the actual code change.
  const prDiff = (d.scan as { pr_diff?: PrDiff } | null | undefined)?.pr_diff;
  return {
    pr: { owner, repo, number, title, url },
    report: d.report,
    artifacts: [],
    prDiff,
    // The reviewer-facing distillation of the scan — risk, suggestions, tests,
    // scope, value — so a "call me" conversation can cover what a reviewer asks,
    // not just the diff. Commit subjects + authors ride alongside (the authors are
    // "who wrote the PR"; neither is in the scan JSON itself).
    reviewBrief: buildReviewBrief(d.scan, d.commits, d.authors),
    detectedAt: d.ts,
  };
}

export function LivePipelineRun({
  onBack,
  onOpenVoice,
  onOpenChat,
  onOpenSettings,
  settings,
  autoScan = true,
}: {
  onBack?: () => void;
  /** Open the voice/phone "Call" surface. Present when this view is the home. */
  onOpenVoice?: () => void;
  /** Open the chat surface (grounded on the current scan). */
  onOpenChat?: () => void;
  /** Open settings. */
  onOpenSettings?: () => void;
  /** Live settings — feeds the Claude top-risks summary (brain url + model). */
  settings?: Settings;
  /** Auto-run/auto-load the active PR's scan on first sight this session.
   *  Default on for the real app; tests pass `false` to drive the flow manually. */
  autoScan?: boolean;
}) {
  const activePr = useActivePr();
  // Home = mounted as the landing dashboard (App passes nav handlers). Tests mount
  // it bare (only onBack) and get the legacy back-arrow header instead.
  const isHome = !!(onOpenChat || onOpenVoice || onOpenSettings);

  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Display | null>(null);
  const [viewing, setViewing] = useState<Display | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  // The PR url the loaded `history` belongs to — lets the auto-scan effect wait
  // until THIS PR's history has actually been read in before deciding run-vs-load.
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  // Every PR we hold scans for (across all tabs) — drives the cross-PR picker.
  const [prGroups, setPrGroups] = useState<PrGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const runStartRef = useRef(0);
  // When the user picks a PR that isn't the active tab, we navigate the browser
  // there and stash what to do once useActivePr catches up: load the latest scan
  // (the PR already has history) or kick off a fresh run (never scanned).
  const pendingRef = useRef<{ url: string; action: 'run' | 'load-latest' } | null>(null);

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
    setHistoryFor(null);
    if (!prUrl) {
      setHistory([]);
      return;
    }
    let live = true;
    void getHistoryForPr(prUrl).then((h) => {
      if (live) {
        setHistory(h);
        setHistoryFor(prUrl);
      }
    });
    return () => {
      live = false;
    };
  }, [prUrl]);

  // Keep the cross-PR picker in sync with stored history. `history` changes on
  // every mutation we care about — initial load, PR switch, a completed run
  // (setHistory), and a delete — so this single dependency covers them all.
  useEffect(() => {
    let live = true;
    void getPrGroups().then((g) => {
      if (live) setPrGroups(g);
    });
    return () => {
      live = false;
    };
  }, [history]);

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
        // The ONE shared engine — the model loads once and the card reuses the
        // same warm worker, so it never "loads again" after the scan.
        const res = await getSharedTtsProvider().synthesize({
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
    // A fresh run supersedes any deferred "load latest on arrival" intent, so a
    // pending jump can't later replace this run's result with an old scan.
    pendingRef.current = null;
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
    // A run is a deliberate "handled" — so the auto-scan effect won't re-fire for
    // this PR after a tab switch-back later this session.
    markAutoHandled(url);

    try {
      // The head-tree zip total, only knowable from a PRIOR download of this repo
      // (GitHub exposes no size before a first download — see downloadSizeEstimate).
      // So this is undefined on the first run (UI shows live bytes + speed) and an
      // exact-ish percentage on every run after. Fail-soft to undefined.
      const estimatePromise = getCachedZipSize(owner, repo).catch(() => undefined);

      // 1. Resolve head sha + PR diff from the STABLE git endpoints (.patch /
      //    .diff) — credentialed, private-repo safe, no fragile DOM scrape.
      patch('resolve', { state: 'active' });
      const [head, diff, prBody] = await Promise.all([
        fetchPrHead(owner, repo, number, sig),
        fetchPrChangedFiles(owner, repo, number, sig),
        // The PR description (best-effort; public repos always, private only with
        // a token). Fail-soft inside, so it never blocks the scan.
        fetchPrBody(owner, repo, number, sig),
      ]);
      const title = head.title ?? null;
      patch('resolve', {
        state: 'done',
        note: `head ${head.headSha.slice(0, 7)} · ${diff.changedPaths.length} changed file(s)`,
      });

      // 2. Download ONLY the HEAD tree (by sha) as raw zip bytes — the unzip is
      //    deferred to the worker so it never blocks this thread.
      patch('download', { state: 'active', note: 'fetching head tree…' });
      const estimatedTotal = await estimatePromise.catch(() => undefined);
      const zipBytes = await downloadArchive(
        owner, repo, head.headSha,
        (p) => patch('download', { note: downloadNote(p) }), sig, estimatedTotal,
      );
      patch('download', { state: 'done', note: `${fmtBytes(zipBytes.length)} downloaded` });
      // Remember the true size so the NEXT run of this repo shows an exact-ish
      // percentage (fire-and-forget; a failed write just means no cached seed).
      void setCachedZipSize(owner, repo, zipBytes.length);

      // 3. Changed files came from the .diff (no base zip, no local tree diff).
      patch('diff', { state: 'active' });
      patch('diff', { state: 'done', note: `${diff.changedPaths.length} changed file(s)` });

      const pr: PrInput = {
        owner, repo, number, title: title ?? undefined,
        body: prBody,
        baseRef: '', headRef: '',
        baseSha: '', headSha: head.headSha,
        changedFiles: diff.changedPaths, diffStats: diff.diffStats, diffStatus: diff.diffStatus,
        // Commit messages from the .patch → feeds the scanner's feat:/fix: counts
        // + value-card (previously empty on the live path) and the Commits section.
        commits: head.commits,
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
          diffStatus: pr.diffStatus,
          prTitle: pr.title,
          prBody: pr.body,
        },
        { signal: sig, onProgress: (p) => patch('scan', { note: p.message }) },
      );
      patch('scan', { state: 'done', note: SCAN_LABEL });

      // 5. The result is the raw scan-pr.json — the React report renders every
      //    section from it directly (no markdown, no action renderer). We attach
      //    the literal +/- code diff (collected client-side from the .diff — the
      //    scanner has no base tree to produce it) so the actual added/removed
      //    lines travel inside the scan-pr JSON (render + export + history).
      patch('render', { state: 'active' });
      const scan: unknown = report;
      if (scan && typeof scan === 'object') {
        (scan as Record<string, unknown>).pr_diff = {
          files: diff.fileDiffs,
          truncated: diff.diffTruncated || undefined,
        };
        // The PR description rides in the scan JSON too, so it renders (live +
        // export + replayed history) and is preserved in the raw export.
        if (prBody) (scan as Record<string, unknown>).pr_description = prBody;
      }
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

        const ts = Date.now();
        const id = `${url}@${head.headSha}@${ts}`;
        const durationMs = ts - runStartRef.current;
        const next: Display = { id, report: driftReport, meta, narration, scan, changedStatus: diff.entries, commits: head.commits, authors: head.authors, ts, durationMs, audio };
        setResult(next);

        const record: ScanRecord = {
          id,
          url, owner, repo, number, title,
          sha: head.headSha,
          ts,
          durationMs,
          caption: summaryLine(driftReport, meta),
          verdict: driftReport.verdict,
          verdictLabel: driftReport.verdictLabel,
          report: driftReport,
          scan,
          narration,
          changedFiles: diff.changedPaths.length,
          changedStatus: diff.entries,
          commits: head.commits,
          authors: head.authors,
        };
        const hist = await addScan(record);
        // Persist the synthesized WAV BEFORE the history row becomes clickable.
        // The old order exposed the row first, so clicking the just-run scan could
        // race the (multi-MB encode + full-storage prune) save: getSpokenAudio
        // returned null and the replay fell back to a "… Synthesizing" re-run. Now
        // the clip is on disk by the time the row appears. Fail-soft.
        if (audio) await saveSpokenAudio(record.id, audio);
        setHistory(hist.filter((r) => r.url === url));
        await setLiveContext(toLiveContext(next));
      } else {
        // No parseable quality block → no narration to speak. Mark the audio step
        // done and still show the comment (no history/chat).
        patch('audio', { state: 'done', note: 'no narration' });
        const durationMs = Date.now() - runStartRef.current;
        setResult({
          id: '', // no narration → no spoken audio to ever persist
          report: { found: true, verdict: 'unknown', verdictLabel: '', effortLabel: null, mergeConfidence: null, gauges: [], blastRadius: null, criticalCount: null, metricCount: null, sections: [], prUrl: url, scrapedAt: 0 },
          meta: { owner, repo, number, title, changedFiles: diff.changedPaths.length },
          narration: '',
          scan,
          changedStatus: diff.entries,
          commits: head.commits,
          authors: head.authors,
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

  // SpokenSummary just lazily synthesized a clip (a replayed scan whose WAV
  // wasn't cached — e.g. one recorded before eager-save existed, or whose eager
  // synthesis failed). Cache it back to that scan's record so the NEXT replay
  // (re-open, or after a reload) is instant. We deliberately do NOT mutate the
  // on-screen display's `audio`: feeding new `prepared` to the mounted
  // SpokenSummary would re-fire its reset effect and cut off the playback that
  // just started. Re-pressing the SAME card is already instant via SpokenSummary's
  // own blob cache; re-opening reads this persisted clip. Fail-soft (storage only).
  const cacheSynthesized = useCallback((id: string, audio: PreparedAudio) => {
    if (id) void saveSpokenAudio(id, audio);
  }, []);

  // "Discuss in chat" — publish this result as the PR's grounding and open the
  // chat, which picks it up and opens with a grounded reasoning turn. As the home
  // surface we navigate via onOpenChat; the legacy back-arrow mount uses onBack.
  const discuss = useCallback(async () => {
    if (!display) return;
    await setLiveContext(toLiveContext(display));
    (onOpenChat ?? onBack)?.();
  }, [display, onOpenChat, onBack]);

  // "Call" — same grounding contract as discuss(): publish the scan CURRENTLY on
  // screen (which may be a replayed/older record, not the latest run) as the PR's
  // live context before opening the voice surface, so Andy talks about exactly what
  // the user is looking at — not whatever run last wrote the context.
  const callAboutScan = useCallback(async () => {
    if (display) await setLiveContext(toLiveContext(display));
    onOpenVoice?.();
  }, [display, onOpenVoice]);

  // "Export JSON" — save the raw scan-pr.json (ScanPrOutput — the exact artifact
  // the GitHub Action produces) to disk. Works for both a live run and a replayed
  // history record, since both carry `scan`. Prefers the native File System
  // Access "Save As" (no download-manager round-trip, no blob URL to leak) and
  // falls back to chrome.downloads where it isn't available — see saveTextFile.
  const exportScan = useCallback(() => {
    if (!display) return;
    void saveTextFile({
      suggestedName: scanExportFilename(display.meta),
      data: JSON.stringify(display.scan, null, 2),
      mime: 'application/json',
      description: 'Drift scan JSON',
    });
  }, [display]);

  // "Export HTML" — save a standalone, offline copy of the report. We snapshot a
  // mounted DOM (not renderToStaticMarkup) on purpose: the mermaid + gauge SVGs
  // are produced in a useEffect and only exist in the mounted tree. We snapshot
  // the OFF-SCREEN, force-expanded copy (exportReportRef) rather than the visible
  // one, so every collapsed section — and the mermaid inside it — is present and
  // the exported render is COMPLETE, not just whatever the user had expanded.
  const reportRef = useRef<HTMLDivElement>(null);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const exportHtml = useCallback(() => {
    if (!display) return;
    // Prefer the fully-expanded off-screen copy; fall back to the visible report.
    const reportHtml =
      exportReportRef.current?.innerHTML ?? reportRef.current?.outerHTML;
    if (!reportHtml) return;
    const { owner = '', repo, number, title } = display.meta;
    const heading = `${owner ? `${owner}/` : ''}${repo} · PR #${number}`;
    const docTitle = title ? `${heading} — ${title}` : heading;
    const when = new Date(display.ts).toLocaleString();
    const header =
      `<header class="drift-export-head"><h1>${escHtml(docTitle)}</h1>` +
      `<p>Drift live scan · ${escHtml(when)}</p></header>`;
    const html = buildScanHtmlDoc({
      title: docTitle,
      theme: resolveActiveTheme(),
      css: `${themeCss}\n${appCss}\n${reportCss}`,
      // Fully-expanded rendered report + full raw JSON (complete, lossless record).
      body: header + reportHtml + buildRawJsonSection(display.scan),
    });
    void saveTextFile({
      suggestedName: scanExportFilename(display.meta, 'html'),
      data: html,
      mime: 'text/html',
      description: 'Drift scan report (HTML)',
    });
  }, [display]);

  const openRecord = useCallback(async (r: ScanRecord) => {
    // Replaying a past scan must arm its WAV immediately — no "… Synthesizing"
    // round-trip. If this is the scan we just ran, its synthesized audio is still
    // in memory (result.audio) — reuse it directly, immune to any save-timing
    // race. Otherwise load the clip persisted alongside the record.
    const inMemory = result && result.ts === r.ts ? result.audio : null;
    const audio = inMemory ?? (await getSpokenAudio(r.id));
    setViewing({ ...recordToDisplay(r), audio });
  }, [result]);

  const deleteRecord = useCallback(
    async (e: React.MouseEvent, r: ScanRecord) => {
      e.stopPropagation();
      const next = await removeScan(r.id);
      await removeSpokenAudio(r.id); // drop its cached WAV too — no orphans
      setHistory(next.filter((x) => x.url === r.url));
      setViewing((v) => (v && v.ts === r.ts ? null : v));
    },
    [],
  );

  // Pick a PR from the cross-PR list. The single click "does the right thing":
  //  • already the active tab → act now (load its latest scan, or run if it has
  //    none).
  //  • a different PR → navigate the browser there and defer the same action to
  //    the pending-intent effect below, which fires once useActivePr lands on it
  //    (and, for a load, once that PR's history has been read in).
  const selectPr = useCallback(
    async (p: { url: string; hasScans: boolean }) => {
      const action = p.hasScans ? 'load-latest' : 'run';
      if (p.url === prUrl) {
        if (action === 'load-latest') {
          // Usually this PR's history is already in state — load its newest scan
          // now. If the read is still in flight, defer to the pending effect,
          // which fires the moment it lands.
          if (history[0] && history[0].url === prUrl) void openRecord(history[0]);
          else pendingRef.current = { url: p.url, action };
        } else if (!running) {
          void run();
        }
        return;
      }
      pendingRef.current = { url: p.url, action };
      setViewing(null);
      setResult(null);
      await openUrlInTab(p.url);
    },
    [prUrl, history, running, openRecord, run],
  );

  // Finish a deferred PR jump once the active tab has caught up to the picked PR.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.url !== prUrl) return;
    if (pending.action === 'load-latest') {
      // Wait until THIS PR's history is the one in state (entries carry its url),
      // then replay its most recent scan. Records exist (the row was scanned), so
      // this resolves as soon as the PR-switch effect's read lands.
      if (history.length > 0 && history[0].url === prUrl) {
        pendingRef.current = null;
        if (prUrl) markAutoHandled(prUrl); // a deliberate jump counts as handled
        void openRecord(history[0]);
      }
      return;
    }
    if (!running) {
      pendingRef.current = null;
      void run(); // run() marks this PR handled itself
    }
  }, [prUrl, history, running, openRecord, run]);

  // Auto-run (or auto-load) the active PR's scan the FIRST time it's seen this
  // session — the "open the panel and it's already working" behaviour. Gated so it
  // never re-fires on a tab switch-back (the session set), never fights a deliberate
  // picker jump (pendingRef), and waits until this PR's history is in (historyFor)
  // so it can choose: replay the latest scan if one exists, else scan fresh.
  useEffect(() => {
    if (!autoScan || !activePr || !prUrl) return;
    if (running) return;
    if (pendingRef.current) return;
    if (historyFor !== prUrl) return; // this PR's history not loaded yet
    if (wasAutoHandled(prUrl)) return;
    markAutoHandled(prUrl);
    if (history.length > 0 && history[0].url === prUrl) {
      void openRecord(history[0]);
    } else {
      void run();
    }
  }, [autoScan, activePr, prUrl, running, historyFor, history, openRecord, run]);

  const liveTotal = running ? now - runStartRef.current : display?.durationMs ?? null;

  // The PR picker: every scanned PR, plus the active tab's PR when it isn't one
  // of them yet — so you can scan a brand-new PR or jump back to a past one even
  // after its GitHub tab is gone. Active PR pinned first, else most-recent first.
  type PrRow = PrGroup;
  const prRows: PrRow[] = (() => {
    const rows: PrRow[] = prGroups.map((g) => ({ ...g }));
    if (activePr && prUrl && !rows.some((r) => r.url === prUrl)) {
      rows.push({
        url: prUrl, owner: activePr.owner, repo: activePr.repo, number: activePr.number,
        title: null, count: 0, lastTs: 0, lastVerdict: 'unknown', lastVerdictLabel: '',
      });
    }
    return rows.sort((a, b) => {
      if (a.url === prUrl) return -1;
      if (b.url === prUrl) return 1;
      return b.lastTs - a.lastTs;
    });
  })();

  // Hero summary for the active PR — prefer the on-screen scan, else fall back to
  // the latest stored record so the card reads as "scanned" even before a load.
  const latest = history[0] ?? null;
  const heroVerdict = display?.report.verdict ?? latest?.verdict ?? 'unknown';
  const heroVerdictLabel = display?.report.verdictLabel ?? latest?.verdictLabel ?? '';
  const heroCaption = display ? summaryLine(display.report, display.meta) : latest?.caption ?? '';
  const heroTitle = display?.meta.title ?? latest?.title ?? null;
  const activeScanned = history.length > 0;
  const hasScan = !!display || activeScanned; // a scan exists for the active PR → Call is meaningful
  // Every OTHER pull request we hold scans for (the active one is the hero above).
  const otherRows = prRows.filter((r) => r.url !== prUrl);

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        {isHome ? (
          <span className="drift-logo" />
        ) : (
          <button className="iconbtn" title="Back" onClick={onBack}>
            ←
          </button>
        )}
        <h1>Live scan</h1>
        {liveTotal != null && liveTotal > 0 && (
          <span className="pl-total" title="Total run time">
            {fmtMs(liveTotal)}
          </span>
        )}
        <span className="spacer" />
        {isHome && (
          <>
            {onOpenChat && (
              <button className="iconbtn" title="Open chat about this PR" onClick={onOpenChat}>
                💬
              </button>
            )}
            {onOpenVoice && (
              <button className="iconbtn" title="Talk to Andy — voice / phone call" onClick={onOpenVoice}>
                🎙
              </button>
            )}
            {onOpenSettings && (
              <button className="iconbtn" title="Settings" onClick={onOpenSettings}>
                ⚙
              </button>
            )}
          </>
        )}
      </header>

      <div className="settings">
        {!activePr && otherRows.length === 0 ? (
          <div className="drift-empty">
            <div className="big">⚡</div>
            Open a GitHub pull request to scan it.
          </div>
        ) : null}

        {/* ── Active PR hero: status + the primary Call / Chat / Re-run actions ── */}
        {activePr && (
          <div className={`pl-hero pl-verdict-${heroVerdict}`}>
            <div className="pl-hero-top">
              <span className="pl-hero-id">
                {activePr.owner}/{activePr.repo} #{activePr.number}
              </span>
              <span className="pl-hero-badges">
                <span className="pl-pr-badge">current tab</span>
                {viewing && <span className="pl-pr-badge pl-badge-past">Past scan</span>}
              </span>
            </div>
            {heroTitle && <div className="pl-hero-title">{heroTitle}</div>}
            <div className="pl-hero-status">
              {running
                ? 'Scanning…'
                : hasScan
                  ? `${heroVerdictLabel || 'Reviewed'}${heroCaption ? ` · ${heroCaption}` : ''}`
                  : 'Not scanned yet'}
            </div>

            <div className="pl-hero-actions">
              {running ? (
                <button className="btn ghost danger" onClick={() => abortRef.current?.abort()}>
                  ◼ Stop
                </button>
              ) : (
                <>
                  {hasScan && onOpenVoice && (
                    <button className="btn" onClick={() => void callAboutScan()} title="Talk to Andy about this scan">
                      📞 Call
                    </button>
                  )}
                  {hasScan && (
                    <button className="btn ghost" onClick={() => void discuss()} title="Open a grounded chat about this PR">
                      💬 Chat
                    </button>
                  )}
                  {activeScanned && !display && (
                    <button
                      className="btn ghost"
                      onClick={() => void selectPr({ url: prUrl!, hasScans: true })}
                      title="Load the latest scan for this PR"
                    >
                      ⤓ Load latest scan
                    </button>
                  )}
                  <button className="btn ghost" onClick={() => void run()}>
                    {activeScanned || display ? '↻ Re-run' : '▶ Run scan'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Live pipeline steps — only while a scan is actually running. */}
        {activePr && running && (
          <div className="pl-steps">
            {steps.map((s) => (
              <StepRow key={s.id} step={s} now={now} />
            ))}
          </div>
        )}

        {error && (
          <div className="dl-strip warn" style={{ marginTop: 10 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Top risks (Claude, on-device fallback) — the at-a-glance headline.
            Gated on a persisted id: the degenerate no-quality display (id '') has
            no real report to summarize, so it skips the card + the brain call. ── */}
        {display && display.id && (
          <TopRisks
            scanId={display.id}
            scan={display.scan}
            report={display.report}
            brainUrl={settings?.voiceBrainUrl}
            model={settings?.voiceModel}
          />
        )}

        {/* Spoken summary — on-device narration, playable inline. */}
        {display?.narration && (
          <SpokenSummary
            text={display.narration}
            prepared={display.audio}
            onSynthesized={display.id ? (audio) => cacheSynthesized(display.id, audio) : undefined}
          />
        )}

        {/* ── Full report (collapsible) — gauges, diagrams, diff, commits ── */}
        {display && (
          <>
            <details className="pl-fold" open>
              <summary className="pl-fold-summary">
                <span className="pl-fold-title">Full report</span>
                <span className="pl-fold-actions" onClick={(e) => e.preventDefault()}>
                  <button className="pl-pill" onClick={exportScan} title="Download the raw scan-pr.json for this scan">
                    ⬇ JSON
                  </button>
                  <button className="pl-pill" onClick={exportHtml} title="Download a standalone, offline HTML copy of this report">
                    ⬇ HTML
                  </button>
                  {viewing && (
                    <button className="pl-pill" onClick={() => setViewing(null)} title="Close this past scan">
                      ✕ Close
                    </button>
                  )}
                </span>
              </summary>
              <div ref={reportRef} className="pl-fold-body">
                <ScanReportView scan={display.scan} changedFiles={display.changedStatus} commits={display.commits} />
              </div>
            </details>

            {/* Off-screen, fully-expanded twin used only as the HTML-export source.
                Kept OUTSIDE the collapsible so its mermaid/gauge useEffects run and
                bake real SVGs even when the visible report is collapsed. */}
            <div
              ref={exportReportRef}
              aria-hidden
              style={{ position: 'absolute', left: -99999, top: 0, width: 980, pointerEvents: 'none' }}
            >
              <ForceExpandContext.Provider value={true}>
                <ScanReportView scan={display.scan} changedFiles={display.changedStatus} commits={display.commits} />
              </ForceExpandContext.Provider>
            </div>
          </>
        )}

        {/* ── Other pull requests (collapsible picker) ── */}
        {otherRows.length > 0 && (
          <details className="pl-fold">
            <summary className="pl-fold-summary">
              <span className="pl-fold-title">Other pull requests · {otherRows.length}</span>
            </summary>
            <div className="pl-prlist pl-fold-body">
              {otherRows.map((p) => {
                const scanned = p.count > 0;
                return (
                  <div key={p.url} className="pl-pr-row">
                    <button
                      className="pl-pr-main"
                      onClick={() => void selectPr({ url: p.url, hasScans: scanned })}
                      title={scanned ? 'Open this PR and load its latest scan' : 'Open this PR and scan it'}
                    >
                      <span className={`pl-hist-dot${scanned ? ` pl-verdict-${p.lastVerdict}` : ''}`} />
                      <span className="grow">
                        <span className="pl-pr-title">
                          {p.owner}/{p.repo} #{p.number}
                        </span>
                        <span className="pl-pr-sub">
                          {scanned
                            ? `${p.count} scan${p.count === 1 ? '' : 's'} · ${p.lastVerdictLabel || 'Reviewed'} · ${fmtAgo(p.lastTs)}`
                            : 'Not scanned yet'}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* ── Recent scans for the active PR (collapsible history) ── */}
        {activePr && history.length > 0 && (
          <details className="pl-fold">
            <summary className="pl-fold-summary">
              <span className="pl-fold-title">Recent scans · {history.length}</span>
            </summary>
            <div className="pl-history pl-fold-body">
              {history.map((r) => {
                const active = viewing != null && viewing.ts === r.ts;
                return (
                  <button
                    key={r.id}
                    className={`pl-hist-row${active ? ' active' : ''}`}
                    onClick={() => void openRecord(r)}
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
          </details>
        )}
      </div>
    </div>
  );
}
