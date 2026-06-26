// The chat's TOOL layer: what the on-device brain can DO (not just say), the
// PR/scan state it reasons over, and the protocol for calling tools.
//
// Protocol: Qwen 2.5 Instruct is trained on Hermes-style tool calls, so we ask
// it to emit `<tool_call>{"name":"…","arguments":{…}}</tool_call>` and parse that
// out of the token stream (parseToolCall). Our tools take no required args, so
// even a small model only has to produce the name — robust. The agent loop
// (agentLoop.ts) runs the tool, feeds the result back, and lets the model answer.
//
// Scale guard: list_changed_files returns NAMES ONLY and is capped, so a huge PR
// never blows the ~4k context window — the model sees the shape of the change,
// not every diff line.

import { runLiveScan, latestScanForPr, type ScanTargetPr } from './runLiveScan';
import { logger } from './debug';
import { truncateToTokens } from './chatContext';
import { buildArchitectureOverview } from '../agents/architecture';
import { runIterativeAgent } from '../agents/iterative-agent';
import { LENSES, type AgentLens } from '../agents/lenses';
import { runHandoverTurn } from '../agents/handover';
import { buildExplainerDoc, type ExplainerDoc } from '../agents/explainerDoc';
import { narrateDeck } from '../agents/deckNarrator';
import type { FilePresentation } from '../agents/scrollPlan';
import { fileGraphFromScan } from './scanFileGraph';
import { runRiskReview } from '../agents/riskReview';
import { isRiskQuestion } from '../agents/riskIntent';
import { parseHandoverIntent } from './handoverIntent';
import { getHandoverSession, currentStep } from '../state/handoverSession';
import { listPrFiles } from '../state/prFileStore';
import type { BrainRuntime } from './brainRuntime';
import type { ChangedFileStatus } from './prDiff';

const log = logger('tool');

/** Up to this many commit SUBJECTS are fed back after a scan (newest kept). */
const COMMIT_SUBJECTS_CAP = 8;
/** The PR description is truncated to this many tokens before it reaches the model. */
const DESCRIPTION_TOKEN_CAP = 400;

/** The fields `buildScanContext` reads — a narrow view of LiveScanResult so the
 *  builder stays pure + unit-testable without a full scan. */
export interface ScanContextInput {
  owner: string;
  repo: string;
  number: number;
  title: string | null;
  caption: string;
  changedCount: number;
  truncated: boolean;
  commits: string[];
  description: string | null;
  report: { verdict: string; verdictLabel: string } | null;
}

/** Build the message fed back to the brain after a scan: the verdict line PLUS
 *  the PR's stated INTENT — title, recent commit subjects, and the description —
 *  so the model can reason about WHY the change was made, not just its metrics.
 *  Every variable-length part is token-capped to stay inside the context window. */
export function buildScanContext(r: ScanContextInput): string {
  const verdict = r.report ? `${r.report.verdictLabel || r.report.verdict}` : 'no quality verdict';
  const lines: string[] = [
    `Scan complete for ${r.owner}/${r.repo}#${r.number}.`,
    `Verdict: ${verdict}. ${r.caption}.`,
    `Changed files: ${r.changedCount}${r.truncated ? ' (diff truncated — very large PR)' : ''}.`,
  ];
  if (r.title) lines.push(`Title: ${r.title}`);
  const subjects = r.commits.map((c) => c.split('\n', 1)[0].trim()).filter(Boolean);
  if (subjects.length) {
    const shown = subjects.slice(-COMMIT_SUBJECTS_CAP); // commits run oldest→newest; keep newest
    const more = subjects.length > shown.length ? ` (last ${shown.length} of ${subjects.length})` : '';
    lines.push(`Commits${more}:`);
    for (const s of shown) lines.push(`- ${s}`);
  }
  const desc = r.description?.trim();
  if (desc) lines.push(`PR description:\n${truncateToTokens(desc, DESCRIPTION_TOKEN_CAP)}`);
  return lines.join('\n');
}

/** What the chat knows about the current PR + scan — shown in the UI chip AND
 *  injected into the system prompt so the model reasons over real state. */
export interface PrToolState {
  pr: ScanTargetPr | null;
  url: string | null;
  title: string | null;
  /** A scan result exists for this PR (this session or in history). */
  scanRan: boolean;
  /** A scan is running right now. */
  scanRunning: boolean;
  /** Changed-file count from the latest scan (null if unknown). */
  changedCount: number | null;
  /** The architecture overview has been built this session (get_pr_architecture
   *  ran) — gates explain_architecture so the deep agent always has the map. */
  architectureKnown: boolean;
  /** A handover walkthrough session EXISTS for this PR (active or completed) — set
   *  while one is in progress, cleared on "stop". Gates the deterministic
   *  `routeHandover` short-circuit so "next"/"proceed"/"resume" capture routing. */
  handoverActive: boolean;
}

export const EMPTY_PR_STATE: PrToolState = {
  pr: null,
  url: null,
  title: null,
  scanRan: false,
  scanRunning: false,
  changedCount: null,
  architectureKnown: false,
  handoverActive: false,
};

export interface ToolRunContext {
  state: PrToolState;
  signal: AbortSignal;
  /** Stream a human-readable progress note for the tool-step UI. */
  onProgress: (note: string) => void;
  /** The on-device brain — tools that reason (explain_architecture) run nested
   *  generations against it. */
  brain: BrainRuntime;
  /** The user's latest message — the question a deep tool must answer. */
  userText: string;
  /** Whether this turn is typed or spoken — lets the handover pace its guided
   *  scroll to reading speed (text) vs TTS speaking speed (voice). Defaults to text. */
  mode?: 'text' | 'voice';
}

export interface ToolResult {
  ok: boolean;
  /** Text fed back to the model as the tool's result message. */
  content: string;
  /** State changes to apply after the tool (e.g. scan ran → file count). */
  statePatch?: Partial<PrToolState>;
  /** Short label for the tool-step card once finished. */
  summary?: string;
  /** On failure: a developer-facing diagnostic report (error + context + the
   *  progress log) the user can copy off the tool-step card so the failure can
   *  be understood and fixed. Built by `buildToolFailureReport`. */
  details?: string;
  /** Terminal for THIS turn: the tool's `content` IS the user-facing reply, emitted
   *  VERBATIM (no answer-model re-generation — which collapsed the handover plan to
   *  "Next."). Also stops the text loop re-routing (a second cursor advance). */
  final?: boolean;
  /** For a `final` tool: a CONDENSED text-to-speech variant of `content` (voice
   *  speaks this; text shows `content`). For the handover, `content` lists every
   *  file — fine to read, painful to hear. Omitted when content is speech-sized. */
  spoken?: string;
  /** The handover's clickable presentation (line-range beats) for this file, so the
   *  chat message can render breathing buttons that replay the scroll+highlight. */
  presentation?: FilePresentation;
  /** The `summary_presentation_deck` tool's narrated slide deck — the chat message
   *  renders it as a playable <DeckPlayer> card (the `deck` message kind). */
  deck?: ExplainerDoc;
}

/** A timestamped progress note captured while a tool runs, kept so a failure can
 *  show WHICH stage it died at (the trail leading up to the error). */
export interface ToolBreadcrumb {
  /** Milliseconds since the tool started. */
  t: number;
  note: string;
}

/**
 * Build the copyable failure report for a failed tool run: the error itself, the
 * PR/scan context it ran against, and the breadcrumb trail (so the last note
 * pinpoints the failing stage) plus the stack. Everything a developer needs to
 * reproduce and fix the failure, in one paste. Shared by the text (agentLoop) and
 * voice (voiceController) tool runners so both copy identical diagnostics.
 */
export function buildToolFailureReport(
  toolName: string,
  state: PrToolState,
  breadcrumbs: ToolBreadcrumb[],
  error: unknown,
  durationMs: number,
): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message || String(err);
  const lastStep = breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1].note : '(no progress recorded)';
  const pr = state.pr ? `${state.pr.owner}/${state.pr.repo}#${state.pr.number}` : 'none';
  const stack = (err.stack ?? '(no stack)')
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
  const log = breadcrumbs.length
    ? breadcrumbs.map((b) => `  [+${(b.t / 1000).toFixed(1)}s] ${b.note}`).join('\n')
    : '  (none)';
  const lines = [
    `Drift — tool "${toolName}" failed`,
    `Error: ${message}`,
    '',
    'Context',
    `  PR: ${pr}`,
    state.url ? `  URL: ${state.url}` : null,
    state.title ? `  Title: ${state.title}` : null,
    `  scan_ran: ${state.scanRan} · scan_running: ${state.scanRunning} · changed_files: ${state.changedCount ?? 'n/a'}`,
    `  Failed after: ${durationMs}ms`,
    `  Last step: ${lastStep}`,
    '',
    'Progress log',
    log,
    '',
    'Stack',
    stack,
  ].filter((l): l is string => l !== null);
  return lines.join('\n');
}

export interface ChatTool {
  name: string;
  /** One line the ROUTER sees — what the tool does + when to use it. */
  description: string;
  /** A short, user-facing phrasing of this capability, shown to the model in the
   *  ANSWER prompt so it can tell the user what it can actually do. */
  capability: string;
  /** A short present-tense action phrase ("Checking for breaking changes…") shown
   *  as the first tool-step note AND spoken by TTS in voice mode. Optional — the
   *  simple scan/list tools don't need a narrated lead-in. */
  spokenAction?: string;
  /** Is this tool callable in the current state? (Gates list_changed_files on a
   *  scan having run, run_live_pr_scan on a PR being open + not already running.) */
  available: (s: PrToolState) => boolean;
  run: (args: Record<string, unknown>, ctx: ToolRunContext) => Promise<ToolResult>;
}

/** Cap on file NAMES returned to the model so a large PR can't overflow context. */
const FILE_NAME_CAP = 60;

/** Sort changed files smallest-change-first (additions+deletions) so a truncated
 *  list still surfaces the most digestible files — matches the user's
 *  "smallest PR to largest" intent for staying under the limit. */
function byChangeSize(a: ChangedFileStatus, b: ChangedFileStatus): number {
  return a.additions + a.deletions - (b.additions + b.deletions);
}

const baseName = (p: string): string => p.split('/').pop() ?? p;

/**
 * Run the grounded qualitative risk review and shape it as a `final` tool result —
 * shared by the two risk tools. `focusPaths` (the handover's current file) scopes the
 * review to those files; omitted, it reviews the whole PR. Always initiates the brain:
 * `runRiskReview` collects diffs from GitHub when the file cache was evicted.
 */
async function runRiskTool(ctx: ToolRunContext, focusPaths?: string[]): Promise<ToolResult> {
  if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
  const rec = await latestScanForPr(ctx.state.pr);
  if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
  const scope = focusPaths?.length ? focusPaths.map(baseName).join(', ') : '';
  ctx.onProgress(scope ? `reviewing the risk in ${scope}…` : 'reviewing the risk in the changed code…');
  log(`${scope ? 'explain_file_risk' : 'explain_risk'} ${rec.owner}/${rec.repo}#${rec.number} · "${ctx.userText.slice(0, 40)}"`);
  const { content, readPaths, verdict } = await runRiskReview({
    rec,
    pr: ctx.state.pr, // lets MAP fetch diffs from GitHub when the file cache was evicted
    focusPaths,
    brain: ctx.brain,
    userText: ctx.userText,
    signal: ctx.signal,
    onProgress: ctx.onProgress,
    mode: ctx.mode ?? 'text',
  });
  // `final`: emit the grounded review VERBATIM (no answer-model re-generation, which
  // collapses a rich multi-section review into a generic sentence). In voice the review
  // is already shaped concise, so TTS speaks it directly.
  return {
    ok: true,
    content,
    spoken: content,
    summary: scope
      ? `Risk · ${scope}`
      : readPaths.length
        ? `Risk review · ${readPaths.length} file(s)`
        : verdict === 'address'
          ? 'Risk · address before merge'
          : 'Risk reviewed',
    final: true,
  };
}

export const TOOLS: ChatTool[] = [
  {
    name: 'run_live_pr_scan',
    description:
      'Run the Drift static analysis scan on the current pull request (downloads the head tree and runs the profiler locally). Use when the user asks to scan/analyze/review the PR, or when you need the scan results to answer.',
    capability: 'Scan/analyze this pull request — run the Drift static profiler on it (run_live_pr_scan).',
    available: (s) => !!s.pr && !s.scanRunning,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open in the current tab.' };
      log(`run_live_pr_scan ${ctx.state.pr.owner}/${ctx.state.pr.repo}#${ctx.state.pr.number}`);
      ctx.onProgress('starting scan…');
      const r = await runLiveScan(ctx.state.pr, {
        signal: ctx.signal,
        onProgress: (p) => ctx.onProgress(`${p.step}: ${p.note}`),
      });
      return {
        ok: true,
        content: buildScanContext(r),
        summary: `Scanned · ${r.changedCount} file(s)`,
        statePatch: { scanRan: true, changedCount: r.changedCount },
      };
    },
  },
  {
    name: 'list_changed_files',
    description:
      "List the names of files changed in the PR (names only, no diff). Requires a scan to have run first. Use when the user asks which files changed or what's in the PR.",
    capability: 'List the files changed in this PR (list_changed_files, after a scan).',
    available: (s) => s.scanRan && !!s.pr,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
      ctx.onProgress('reading changed files…');
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      log(`list_changed_files → ${rec.changedFiles} file(s)`);
      const files = (rec.changedStatus ?? []).slice().sort(byChangeSize);
      const total = rec.changedFiles ?? files.length;
      const shown = files.slice(0, FILE_NAME_CAP);
      const lines = shown.map((f) => `${f.code} ${f.path}`);
      const more = total > shown.length ? `\n… and ${total - shown.length} more file(s).` : '';
      const content = shown.length
        ? `${total} changed file(s):\n${lines.join('\n')}${more}`
        : `${total} changed file(s) (no per-file detail recorded).`;
      return { ok: true, content, summary: `${total} changed file(s)` };
    },
  },
  {
    name: 'get_pr_architecture',
    description:
      "Get a compact map of the PR's architecture (affected roots, key files, data structures, call-graph changes, business logic) from the scan. Use when the user asks about the PR's architecture/design/structure or how it fits together. Run this BEFORE explaining the architecture in depth.",
    capability: "Map this PR's architecture — affected roots, key files, data structures, call-graph changes (get_pr_architecture).",
    available: (s) => s.scanRan && !!s.pr && !s.architectureKnown,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      ctx.onProgress('reading architecture…');
      log(`get_pr_architecture ${rec.owner}/${rec.repo}#${rec.number}`);
      return {
        ok: true,
        content: buildArchitectureOverview(rec),
        summary: 'Mapped architecture',
        statePatch: { architectureKnown: true },
      };
    },
  },
  {
    name: 'explain_architecture',
    description:
      'Answer a deep question about the PR by reading the relevant changed files one-by-one (the iterative agent) and explaining how they fit the architecture. Requires the architecture to have been mapped first. Use for "how/why does this work", "walk me through it", or any question needing the actual file contents.',
    capability: 'Answer deep "how/why does this work" questions by reading the changed files one-by-one (explain_architecture).',
    available: (s) => s.scanRan && !!s.pr && s.architectureKnown,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      const allFiles = await listPrFiles(rec.url, rec.sha).catch(() => [] as Array<{ path: string; status: string }>);
      ctx.onProgress(`exploring ${allFiles.length} file(s)…`);
      log(`explain_architecture ${rec.owner}/${rec.repo}#${rec.number} · ${allFiles.length} readable file(s)`);
      // During a handover, "here" / "this change" / "this file" means the file currently
      // on screen. Read that file FIRST (so its content + diff ground the answer) and name
      // it in the question so the model knows what "here" refers to.
      const session = await getHandoverSession(rec.url).catch(() => null);
      const currentFile = session ? (currentStep(session)?.path ?? null) : null;
      const files = currentFile
        ? [...allFiles.filter((f) => f.path === currentFile), ...allFiles.filter((f) => f.path !== currentFile)]
        : allFiles;
      // Name the on-screen file IN the question so file-ranking floats it first AND
      // "here"/"this file" resolves; the 3-LEVEL output shape goes via answerFormat (the
      // system-prompt channel) so the weak model actually obeys it — see iterative-agent.
      const question = currentFile ? `${ctx.userText}\n\nThe file currently under review is ${currentFile} — answer about THAT file.` : ctx.userText;
      const answerFormat = currentFile
        ? 'Structure the answer as three short, labelled levels, grounded ONLY in the file content + diff — do not invent:\n' +
          "Level 1 — PR change: in one line, what this PR changes in this file overall.\n" +
          'Level 2 — What the file does: a high-level summary of the file’s purpose, then one low-level line on how it works.\n' +
          'Level 3 — The changes: the specific functions/lines this PR changed, and the one thing to verify.'
        : undefined;
      const { answer, readPaths } = await runIterativeAgent({
        brain: ctx.brain,
        question,
        answerFormat,
        architecture: buildArchitectureOverview(rec),
        url: rec.url,
        sha: rec.sha,
        files,
        signal: ctx.signal,
        onProgress: ctx.onProgress,
      });
      return {
        ok: true,
        content: answer,
        summary: readPaths.length ? `Read ${readPaths.length} file(s)` : 'Explained',
      };
    },
  },
  {
    name: 'pr_handover_mode',
    description:
      'Guided, file-by-file PR walkthrough that DRIVES THE BROWSER to each change, explains it, and stops for you to proceed. Use to START a handover ("walk me through this PR", "give me a guided review"), and — once it is running — for "next"/"proceed"/"continue", "go to <file>", "back", "resume", "where are we", or "stop".',
    capability:
      'Give a guided, file-by-file PR handover — I navigate the browser to each change, explain it high-level → low-level, and pause for you to proceed (pr_handover_mode).',
    spokenAction: 'Walking through the PR…',
    available: (s) => s.scanRan && !!s.pr,
    async run(_args, ctx) {
      if (!ctx.state.pr || !ctx.state.url) return { ok: false, content: 'No pull request is open in the current tab.' };
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      log(`pr_handover_mode ${rec.owner}/${rec.repo}#${rec.number} · "${ctx.userText.slice(0, 40)}"`);
      const r = await runHandoverTurn({
        pr: ctx.state.pr,
        url: ctx.state.url,
        rec,
        userText: ctx.userText,
        brain: ctx.brain,
        signal: ctx.signal,
        onProgress: ctx.onProgress,
        mode: ctx.mode ?? 'text',
      });
      // Attach the FILE-SCOPED change-impact graph (the file's call-graph blast radius)
      // to the file step's presentation, so the message renders the interactive diagram.
      // Done HERE (not in handover) because every presentation — walkthrough AND deep
      // dive, text AND voice — funnels through this one result. Derived from the cached
      // scan; null (no diagram) when the scan has no structured graph for the file.
      let presentation = r.presentation;
      if (presentation) {
        const graph = fileGraphFromScan(rec.scan, presentation.path);
        if (graph) presentation = { ...presentation, graph };
      }
      // `final`: the content IS the reply — emit verbatim (no re-generation) and
      // don't re-route this turn. `spoken` is the condensed variant voice speaks;
      // `presentation` carries the clickable beats for the message buttons.
      return {
        ok: true,
        content: r.content,
        spoken: r.spoken,
        summary: r.summary,
        statePatch: { handoverActive: r.handoverActive },
        final: true,
        presentation,
      };
    },
  },
  {
    name: 'summary_presentation_deck',
    description:
      'Build a narrated PR summary DECK from the scan — a playable slide presentation (overview, per-file deep dives, change-impact graph, scope map, critique) with synced two-host narration the user can play and drill into. Use when the user asks for a deck, a slide deck, a presentation, a summary deck, a narrated or visual walkthrough, or an overview to "present"/"play". For a step-by-step BROWSER-DRIVEN walkthrough instead, use pr_handover_mode.',
    capability:
      'Build a narrated summary presentation deck — overview, per-file slides, change-impact graph, scope map and critique, playable with drill-in (summary_presentation_deck).',
    spokenAction: 'Composing the summary presentation deck…',
    available: (s) => s.scanRan && !!s.pr,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      ctx.onProgress('composing the deck…');
      const deck = buildExplainerDoc(rec);
      // Attach the file-scoped change-impact graph to slides that name a file (and
      // to the graph slide via the lead file) — derived from the cached scan, same
      // helper the handover uses; null when the scan has no structured graph.
      const focusPath = deck.slides.find((s) => s.kind === 'file')?.path;
      for (const s of deck.slides) {
        const p = s.path ?? (s.kind === 'graph' ? focusPath : undefined);
        if (p) {
          const g = fileGraphFromScan(rec.scan, p);
          if (g) s.graph = g;
        }
      }
      // Each slide is written by the brain — one grounded agent per slide, in
      // sequence, token-bounded — so the deck reads like analysis, not a template.
      // Soft: a brain/abort failure keeps that slide's deterministic narration.
      await narrateDeck(rec, deck, { brain: ctx.brain, signal: ctx.signal, onProgress: ctx.onProgress }).catch(() => deck);
      log(`summary_presentation_deck ${rec.owner}/${rec.repo}#${rec.number} · ${deck.slides.length} slide(s)`);
      const kinds = deck.slides.map((s) => s.kind).join(' → ');
      const mins = Math.max(1, Math.round(deck.totalSec / 60));
      // `final`: the deck card IS the reply — emit verbatim, no answer-model re-gen
      // (same contract as pr_handover_mode). `deck` carries the playable ExplainerDoc.
      return {
        ok: true,
        content:
          `Built a ${deck.slides.length}-slide summary presentation deck for ${rec.owner}/${rec.repo}#${rec.number}. ` +
          `Verdict: ${deck.verdictLabel || deck.verdict}. Slides: ${kinds}. ` +
          `Press play for the ~${mins} min narrated walkthrough, or tap a question to drill in.`,
        // In voice mode the deck auto-plays its own narration, so keep the spoken
        // lead-in short (the voice loop speaks this) to avoid talking over the deck.
        spoken:
          ctx.mode === 'voice'
            ? 'Here is your PR summary presentation deck.'
            : `Here's a ${deck.slides.length}-slide summary presentation deck — press play for the narrated walkthrough.`,
        summary: `Summary presentation deck · ${deck.slides.length} slides`,
        final: true,
        deck,
      };
    },
  },
  {
    name: 'explain_risk',
    description:
      "Give a QUALITATIVE risk review of the WHOLE PR — reasoned over the actual code, diff, flow, and call graph (NOT a list of scores): the soundness of the logic, whether the change fits the architecture, what could break downstream and how to mitigate it, and what could have been implemented better. Use when the user asks what the risk is, what could go wrong / break / fail, whether it's safe to merge, what to address or fix first, or why the verdict is what it is — when NOT walking through a specific file. Prefer this over assess_merge_risk — it grounds in the scan's findings + blast-radius graph.",
    capability:
      "Give a qualitative risk review of the whole PR — logic, architecture fit, breaking-change risk + mitigation, and what could be done better, grounded in the code and call graph (explain_risk).",
    spokenAction: 'Reviewing the risk in the code…',
    available: (s) => s.scanRan && !!s.pr,
    run: (_args, ctx) => runRiskTool(ctx),
  },
  {
    name: 'explain_file_risk',
    description:
      "Give a QUALITATIVE risk review of the FILE currently open in the handover walkthrough (not the whole PR): the soundness of its logic, what its change could break downstream and how to mitigate it, and what could be done better — grounded in that file's diff and call graph. Use when a handover walkthrough is active and the user asks about the risk / what could break / what to fix in the file being walked through.",
    capability: "Review the risk of the file you're walking through — what could break in it and how to mitigate (explain_file_risk).",
    spokenAction: 'Reviewing the risk in this file…',
    // Only meaningful mid-walkthrough — a session exists for the open PR.
    available: (s) => s.scanRan && !!s.pr && s.handoverActive,
    async run(_args, ctx) {
      // Scope to the file the walkthrough is positioned on; at the overview (no current
      // file) fall back to a whole-PR review so the question is never met with nothing.
      const session = ctx.state.url ? await getHandoverSession(ctx.state.url).catch(() => null) : null;
      const step = session ? currentStep(session) : null;
      return runRiskTool(ctx, step ? [step.path] : undefined);
    },
  },
  // The 5 specialized question agents — one shared iterative engine, per-lens
  // task + file-bias + narration (see agents/lenses.ts). All read the changed
  // files so their answers are GROUNDED (real paths/contents), not guessed.
  ...LENSES.map(lensTool),
];

/** Deterministic handover routing — the analog of `isMetaQuestion`, run BEFORE the
 *  LLM router in both loops. A 1.5B model can't reliably tell "next"/"proceed"/"yes"
 *  from a fresh PR question, so we resolve the walkthrough's CONTROL utterances in
 *  code. "start"/"stop" can fire anytime a scan exists; movement/status only while a
 *  session is live. Returns null → let the LLM router decide (off-topic question
 *  mid-walkthrough falls through to the lenses). */
export function routeHandover(userText: string, state: PrToolState): 'pr_handover_mode' | null {
  if (!state.scanRan || !state.pr) return null; // tool unavailable
  const intent = parseHandoverIntent(userText);
  if (!intent) return null;
  if (intent.kind === 'start' || intent.kind === 'stop') return 'pr_handover_mode';
  return state.handoverActive ? 'pr_handover_mode' : null;
}

/** Deterministic RISK routing — the analog of `routeHandover`, run in the same
 *  forced short-circuit BEFORE the LLM router (and before the meta/chit-chat guard).
 *  A direct risk question ("what's the risk", "is it safe to merge", "what could
 *  break") must be answered from the scan's COMPUTED signals, not generated freely —
 *  so it routes to a grounded risk review. SCOPE follows context: while a handover
 *  walkthrough is live, the question is about the file being walked through →
 *  `explain_file_risk`; otherwise it's about the whole PR → `explain_risk`. Requires a
 *  scan (the signals don't exist otherwise). Returns null → normal routing (so a nuanced
 *  risk ask the matcher misses can still reach the assess_merge_risk lens via the LLM). */
export function routeRisk(userText: string, state: PrToolState): 'explain_risk' | 'explain_file_risk' | null {
  if (!state.scanRan || !state.pr) return null; // tool unavailable
  if (!isRiskQuestion(userText)) return null;
  return state.handoverActive ? 'explain_file_risk' : 'explain_risk';
}

/** Deterministic DECK routing — the analog of routeHandover/routeRisk. The weak 1.5B
 *  router won't reliably pick summary_presentation_deck from its description (it answers in
 *  prose instead), so a direct "deck / slide deck / summary deck / presentation"
 *  request is forced to the tool in code. Requires a scan (the deck is built from it),
 *  and not while a handover is live (so "next"/"stop" there isn't hijacked). Returns
 *  null → normal LLM routing. */
export function routeDeck(userText: string, state: PrToolState): 'summary_presentation_deck' | null {
  if (!state.scanRan || !state.pr) return null; // tool unavailable
  if (state.handoverActive) return null; // don't hijack an active walkthrough
  return /\b(slide\s*)?deck\b|\bpresentation\b|\bslide\s?show\b/i.test(userText) ? 'summary_presentation_deck' : null;
}

/** Turn a lens (agents/lenses.ts) into a routable, grounded ChatTool. Each runs
 *  the shared iterative agent under its task lens, narrating its action first. */
function lensTool(lens: AgentLens): ChatTool {
  return {
    name: lens.id,
    description: lens.routerDescription,
    capability: lens.capability,
    spokenAction: lens.spokenAction,
    available: (s) => s.scanRan && !!s.pr,
    async run(_args, ctx) {
      if (!ctx.state.pr) return { ok: false, content: 'No pull request is open.' };
      const rec = await latestScanForPr(ctx.state.pr);
      if (!rec) return { ok: false, content: 'No scan result found — run run_live_pr_scan first.' };
      const files = await listPrFiles(rec.url, rec.sha).catch(() => [] as Array<{ path: string; status: string }>);
      ctx.onProgress(lens.spokenAction); // first "thinking" line — shown + spoken in voice
      log(`${lens.id} ${rec.owner}/${rec.repo}#${rec.number} · ${files.length} readable file(s)`);
      const { answer, readPaths } = await runIterativeAgent({
        brain: ctx.brain,
        question: ctx.userText,
        architecture: buildArchitectureOverview(rec),
        url: rec.url,
        sha: rec.sha,
        files,
        signal: ctx.signal,
        onProgress: ctx.onProgress,
        lens: { instruction: lens.instruction, answerFormat: lens.answerFormat, rankFiles: lens.rankFiles },
      });
      return {
        ok: true,
        content: answer,
        summary: readPaths.length ? `Read ${readPaths.length} file(s)` : lens.summaryNoun,
      };
    },
  };
}

export function getAvailableTools(state: PrToolState): ChatTool[] {
  return TOOLS.filter((t) => t.available(state));
}

export function findTool(name: string): ChatTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** The live PR/scan context block, shared by the router + answer prompts. */
function contextBlock(state: PrToolState): string {
  const lines = [
    `- scan_ran: ${state.scanRan}`,
    `- scan_running: ${state.scanRunning}`,
    state.pr ? `- current_pr: ${state.pr.owner}/${state.pr.repo}#${state.pr.number}` : '- current_pr: none',
    state.url ? `- pr_link: ${state.url}` : null,
    state.title ? `- pr_title: ${state.title}` : null,
    state.changedCount != null ? `- changed_files: ${state.changedCount}` : null,
    `- architecture_known: ${state.architectureKnown}`,
    state.handoverActive ? `- handover_in_progress: true` : null,
  ].filter(Boolean);
  return `Current context:\n${lines.join('\n')}`;
}

/** The capabilities the model can describe when the user asks "what can you do /
 *  what tools can you run". Always the FULL set (not gated) so the model can
 *  explain everything it offers, noting a scan is the prerequisite for the rest. */
function capabilitiesBlock(): string {
  const caps = TOOLS.map((t) => `- ${t.capability}`).join('\n');
  return (
    `What you can do (you run these tools yourself when relevant — never tell the user to run them):\n${caps}\n\n` +
    `If the user asks what you can do, what tools / functions you can run, or how to use you, ` +
    `answer ONLY by describing these capabilities in plain language — do not summarize or invent the PR's ` +
    `contents. State PR facts only from the context above or tool results in this conversation; never fabricate ` +
    `them. Do NOT emit any tool-call syntax in your reply.`
  );
}

/** ANSWER-phase system prompt: persona + live context + the capability list (so
 *  the model can answer "what can you do?"). No tool-call syntax — the answer is
 *  freeform; tool results (when any) arrive as prior messages. */
export function buildSystemPrompt(persona: string, state: PrToolState): string {
  return `${persona}\n\n${contextBlock(state)}\n\n${capabilitiesBlock()}`;
}

/** Heuristic: is this message about the ASSISTANT (its abilities / how to use it)
 *  or pure social chit-chat — i.e. NOT a request that any tool should serve? A
 *  1.5B router can't be trusted to tell "Cool functions can you run?" apart from a
 *  PR question, so we short-circuit the unambiguous cases to "none" deterministically
 *  (the "restrict tool calls" prompt principle, enforced in code). Patterns require
 *  assistant-referent phrasing ("…you can/do you…", greetings) so a real PR question
 *  ("what does the run function do here?") is NOT swallowed. Shared by the text
 *  (agentLoop) and voice (voiceController) routers. */
export function isMetaQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Pure greeting / acknowledgement / farewell, nothing else.
  if (/^(hi|hello|hey|yo|sup|thanks|thank you|thx|ty|cool|nice|great|ok|okay|k|got it|bye|goodbye|gm|gn|good (morning|evening|night))[\s!.?]*$/.test(t))
    return true;
  // Questions about the assistant itself / its capabilities.
  return (
    /\bwhat (can|could) (you|u) (do|help)\b/.test(t) ||
    /\bwhat (tools?|functions?|commands?|capabilities|features) (can|do) (you|u)\b/.test(t) ||
    /\b(tools?|functions?|commands?|capabilities) (can|do) (you|u) (run|use|call|do|have)\b/.test(t) ||
    /\bhow (do|can) (i|we) use (you|this|u)\b/.test(t) ||
    /\b(who|what) are you\b/.test(t)
  );
}

/** ROUTER-phase system prompt: ask the model to pick ONE available tool (or
 *  "none"). Paired with `routerSchema` so the output is grammar-constrained.
 *
 *  Principles (see prompt-engineering research): short + action-based, no
 *  calling-bias hyperbole, sectioned, and rules ONLY for tools that are actually
 *  selectable in this state (so the model never reads guidance for a choice it
 *  can't make). The meta/chit-chat guard is listed first because it's the most
 *  commonly mis-fired. */
export function buildRouterSystemPrompt(persona: string, state: PrToolState): string {
  const tools = getAvailableTools(state);
  const toolDocs = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  const has = (n: string) => tools.some((t) => t.name === n);

  const rules: string[] = [
    `- The user asks about YOU — what you can do, what tools / functions / commands you can run, how to use you — or just greets, thanks, or makes small talk → "none". You answer in words; no tool describes you.`,
  ];
  if (has('pr_handover_mode')) {
    rules.push(
      `- The user wants a guided walkthrough / handover / file-by-file or step-by-step review or tour of the PR, OR — while one is in progress (handover_in_progress) — says next / proceed / continue / "go to <file>" / back / resume / "where are we" / "go deeper" / "tell me more" / "I have a question" / stop → pr_handover_mode (NOT explain_architecture).`,
    );
  }
  if (has('summary_presentation_deck')) {
    rules.push(
      `- The user wants a DECK / slide deck / summary deck / scan summary deck / presentation, or says "present" / "play" the PR / "show me a deck" / "give me a deck" / "summary deck" → summary_presentation_deck (a playable slide card; NOT pr_handover_mode, which drives the browser file-by-file).`,
    );
  }
  if (has('run_live_pr_scan')) {
    rules.push(
      `- scan_ran is false AND the user asks about THIS pull request's code, changes, quality, intent, or "what's going on here" → run_live_pr_scan. A scan is the only way to read the PR — scan it, don't ask the user to paste it.`,
      `- The user says scan / analyze / review / check the PR → run_live_pr_scan.`,
    );
  }
  if (has('list_changed_files')) rules.push(`- The user asks which files changed → list_changed_files.`);
  if (has('get_pr_architecture')) rules.push(`- The user asks about the PR's architecture, design, or structure → get_pr_architecture.`);
  if (has('explain_architecture'))
    rules.push(`- The user asks a deep "how / why does this work", "walk me through it", or anything needing the actual file contents → explain_architecture.`);
  if (has('explain_risk'))
    rules.push(
      `- The user asks what the RISK is, what could go wrong / break / fail, whether it's safe to merge, what to address or fix first, or about a risk metric (blast radius, review fatigue, fragility) → explain_risk (NOT assess_merge_risk — explain_risk reads the scan's computed signals).`,
    );
  if (has('explain_file_risk'))
    rules.push(
      `- During a handover walkthrough, a risk question ("what could break here", "is this file safe", "what to fix") is about the FILE being walked through → explain_file_risk (the file-scoped review), NOT explain_risk (the whole PR).`,
    );
  // The specialized question agents (available once a scan ran). Each rule is
  // generated from the lens's own example questions, so the routing contract lives
  // in agents/lenses.ts (one source of truth) and can't drift on a rename.
  for (const lens of LENSES) {
    if (has(lens.id)) rules.push(`- The user asks ${lens.examples.map((e) => `"${e}"`).join(', ')} → ${lens.id}.`);
  }
  rules.push(`- Anything else → "none".`);

  return (
    `${persona}\n\n${contextBlock(state)}\n\n` +
    `Route the user's latest message to ONE tool, or "none" to reply in words.\n\n` +
    `Tools:\n${toolDocs}\n\n` +
    `Rules — use the FIRST that matches:\n${rules.join('\n')}\n\n` +
    `Reply with JSON only: {"tool":"<name>"} or {"tool":"none"}.`
  );
}

/** Stringified JSON schema for the router decision. `tool` is enum-locked to the
 *  AVAILABLE tools + "none", so XGrammar makes an invalid/unavailable choice
 *  impossible. */
export function routerSchema(state: PrToolState): string {
  const names = getAvailableTools(state).map((t) => t.name);
  return JSON.stringify({
    type: 'object',
    properties: { tool: { type: 'string', enum: [...names, 'none'] } },
    required: ['tool'],
  });
}

/** Parse the router's (grammar-constrained) JSON decision → an available tool
 *  name, or null for "answer directly". Defensive even though XGrammar should
 *  guarantee validity. */
export function parseRouterDecision(text: string, state: PrToolState): string | null {
  try {
    const obj = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(obj ? obj[0] : text) as { tool?: string };
    const name = j?.tool;
    if (!name || name === 'none') return null;
    const tool = findTool(name);
    return tool && tool.available(state) ? name : null;
  } catch {
    return null;
  }
}
