// The GROUNDED answer agent — answers a deep question about a PR by reading its
// changed files and synthesizing one answer. Faithful to how Aider and Goose
// actually work (verified against their source), NOT a per-step LLM router:
//
//   • Aider selects context DETERMINISTICALLY — a ranking algorithm (tree-sitter
//     + personalized PageRank, seeded by the files/identifiers the request
//     mentions) fits the repo map to a token budget with ZERO LLM calls, then
//     does ONE generation. No per-file "should I read this?" LLM loop.
//   • Goose does ONE generation per turn; when it emits text (no tool calls) that
//     text IS the answer. There is no separate "decide then answer" round-trip.
//
// So we DON'T spend the (weak, slow) 1.5B model on per-step file-picking. We rank
// the changed files deterministically — a per-lens bias PLUS a boost for files the
// QUESTION names (aider's `mentioned_fnames` personalization seed) — read the top
// ones from IndexedDB (no LLM), map-reduce-summarize ONLY if the working set would
// overflow Qwen's ~4k window, then make exactly ONE streamed answer call.
//
// Cost: small/focused PR → 1 LLM call total (the answer). Big PR → a few summary
// calls + 1 answer. Previously this was ~2 calls PER read step plus a throwaway
// "stop" decision — strictly more round-trips for a worse result.

import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';
import { countTokens, estimateTokens, truncateToTokens } from '../core/chatContext';
import { getPrFile } from '../state/prFileStore';

// Re-export so existing importers (tests) keep one entry point for token clamps.
export { truncateToTokens };

/** Working-set ceiling (architecture + question + read files). Crossing it
 *  triggers map-reduce summarization. Sits below Qwen's 4k so the reply fits. */
export const COMPACT_AT_TOKENS = 1800;
/** Per-file observation budget: file content + its diff, capped (head+tail). */
export const READ_CONTENT_TOKENS = 460;
export const READ_DIFF_TOKENS = 150;
/** Target size of each per-file summary produced during map-reduce. */
export const FILE_SUMMARY_TOKENS = 180;
/** The final answer prompt (system half) is clamped to this. */
export const ANSWER_CONTEXT_TOKENS = 2600;
/** Max changed files read for one answer — bounds summary cost on a huge PR.
 *  Ranking puts the most relevant first, so the tail rarely matters. */
export const DEFAULT_MAX_FILES = 8;

export interface ReadableFile {
  path: string;
  status: string;
}

/** A task LENS — the only thing that differs between the specialized agents
 *  (breaking-changes, merge-risk, features, …). Same loop + retrieval + budget;
 *  per-lens instruction, answer shape, and file-selection bias. Mirrors aider's
 *  "modes change only the system prompt over the same repo map". */
export interface IterativeLens {
  /** Task framing injected into every reasoning/summary/answer prompt. */
  instruction: string;
  /** Output-shape guidance appended to the final answer prompt (sections, tone). */
  answerFormat?: string;
  /** Reorder the readable files so the most relevant for THIS task come first
   *  (the read_file menu is capped, so order decides what the agent can open). */
  rankFiles?: (files: ReadableFile[]) => ReadableFile[];
}

export interface IterativeAgentOpts {
  brain: BrainRuntime;
  /** The user's question to answer. */
  question: string;
  /** The architecture overview (from buildArchitectureOverview) seeding the loop. */
  architecture: string;
  /** PR identity for reads (prFileStore key). */
  url: string;
  sha: string;
  /** The files the agent may read (the scan's changed files in IndexedDB). */
  files: ReadableFile[];
  signal: AbortSignal;
  onProgress?: (note: string) => void;
  /** Max changed files to read for this answer (default DEFAULT_MAX_FILES). */
  maxFiles?: number;
  /** Optional task lens — when absent, behaves as the generic explainer. */
  lens?: IterativeLens;
}

export interface IterativeAgentResult {
  /** The synthesized answer text. */
  answer: string;
  /** Paths the agent actually opened, in read order. */
  readPaths: string[];
}

interface ReadFile {
  path: string;
  status: string;
  /** Capped raw observation (content + diff). */
  raw: string;
  /** Set once map-reduce has compressed this file. */
  summary?: string;
}

/** Answer `question` from the PR's changed files. Deterministic selection (no
 *  per-step LLM calls) → budget-bounded reads → map-reduce only if over budget →
 *  ONE answer. Never throws for an empty/abort case — best-effort answer. */
export async function runIterativeAgent(opts: IterativeAgentOpts): Promise<IterativeAgentResult> {
  const { brain, question, architecture, url, sha, signal, lens } = opts;
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
  const progress = opts.onProgress ?? (() => {});

  // ── select files DETERMINISTICALLY (aider-style): per-lens bias + a boost for
  //    files the question names. No LLM call — the small model's capacity is spent
  //    only on the answer, not on routing it does poorly. ──
  const ranked = selectFiles(opts.files, question, lens);
  const picked = ranked.slice(0, maxFiles);
  const omitted = ranked.length - picked.length; // changed files we couldn't read
  const reads: ReadFile[] = [];

  // ── read the picked files from IndexedDB (no LLM), capped per file ──
  for (const f of picked) {
    if (signal.aborted) break;
    progress(`reading ${f.path}…`);
    const file = await getPrFile(url, sha, f.path).catch(() => null);
    if (file) {
      const content = capHeadTail(file.content, READ_CONTENT_TOKENS);
      const diff = file.diff ? `\n--- diff ---\n${capHeadTail(file.diff, READ_DIFF_TOKENS)}` : '';
      reads.push({ path: f.path, status: file.status, raw: `${content}${diff}` });
    } else {
      reads.push({ path: f.path, status: '?', raw: '(file not found in the scan cache)' });
    }
  }

  // ── map-reduce ONLY if the working set would overflow the window. Compress the
  //    LEAST-relevant (tail) files FIRST and stop as soon as it fits — so the
  //    top-ranked files stay full (better fidelity + "lost in the middle" puts the
  //    weakest at the edges) and we make the FEWEST summary calls (faster on-device).
  //    Small PR → no summary calls at all. ──
  if (!signal.aborted && workingTokens(architecture, question, reads) > COMPACT_AT_TOKENS) {
    progress('summarizing files…');
    for (let i = reads.length - 1; i >= 0 && !signal.aborted; i--) {
      if (workingTokens(architecture, question, reads) <= COMPACT_AT_TOKENS) break;
      const r = reads[i];
      if (r.summary) continue;
      r.summary = (await summarizeFile(brain, question, r, signal, lens).catch(() => null)) ?? truncateToTokens(r.raw, FILE_SUMMARY_TOKENS);
    }
  }

  // ── ONE answer generation over {architecture + (summarized) files + question} ──
  progress('answering…');
  const answer = (await brain.generate(answerMessages(architecture, question, reads, lens, omitted), { signal })).trim();
  // Ground the answer: flag any file PATHS it cited that aren't in the PR's
  // changed set. The cached diff is our external oracle — the read-only analog of
  // "run the tests" — so we catch invented citations deterministically (no extra
  // LLM call, no self-critique, which small models do poorly).
  return { answer: groundCitations(answer, opts.files), readPaths: reads.map((r) => r.path) };
}

const CODE_EXT = new Set(
  'ts tsx js jsx mjs cjs json rs py go java rb php css scss less html vue svelte md mdx yml yaml toml sh c cc cpp h hpp sql kt swift'.split(' '),
);

/** File-path-like citations in `answer` (tokens containing a "/" and ending in a
 *  code extension) that are NOT among `known` — neither by full path nor basename.
 *  Conservative (requires a slash) to avoid flagging prose like "Node.js". */
export function findUngroundedCitations(answer: string, known: ReadableFile[]): string[] {
  const full = new Set(known.map((f) => f.path.toLowerCase()));
  const base = new Set(known.map((f) => (f.path.split('/').pop() ?? '').toLowerCase()));
  const out = new Set<string>();
  for (const m of answer.matchAll(/[\w.\-/]*\/[\w.\-]+\.([a-z]{1,5})\b/gi)) {
    const token = m[0];
    if (!CODE_EXT.has(m[1].toLowerCase())) continue;
    const lc = token.toLowerCase();
    if (full.has(lc) || base.has(lc.split('/').pop() ?? lc)) continue;
    out.add(token);
  }
  return [...out];
}

/** Append an honest caveat when the answer cited files outside the PR's changed
 *  set (it inspected only changed files). Returns the answer unchanged if clean. */
export function groundCitations(answer: string, known: ReadableFile[]): string {
  const ungrounded = findUngroundedCitations(answer, known);
  if (!ungrounded.length) return answer;
  return `${answer}\n\n_(Note: these aren't among the PR's changed files I inspected — treat as uncertain: ${ungrounded.slice(0, 6).join(', ')}.)_`;
}

/** Deterministic file ranking — aider's personalization seed, cheaply: order by
 *  the lens's task bias, then float files the QUESTION names (by basename) to the
 *  front. Pure + LLM-free, so selection costs nothing and is reproducible. */
export function selectFiles(files: ReadableFile[], question: string, lens?: IterativeLens): ReadableFile[] {
  const biased = lens?.rankFiles ? lens.rankFiles(files) : files;
  const rankOf = new Map(biased.map((f, i) => [f.path, i]));
  // Whole-token match so "zebra.ts" isn't matched by the substring "a.ts".
  // A token boundary is anything that isn't a filename char (\w . -).
  const named = (needle: string): boolean =>
    new RegExp(`(^|[^\\w.-])${needle.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([^\\w.-]|$)`, 'i').test(question);
  const mentions = (path: string): boolean => {
    const base = path.split('/').pop() ?? path;
    const noExt = base.replace(/\.[^.]+$/, '');
    return named(base) || (noExt.length >= 4 && named(noExt));
  };
  return [...files].sort((a, b) => {
    const ma = mentions(a.path) ? 0 : 1;
    const mb = mentions(b.path) ? 0 : 1;
    if (ma !== mb) return ma - mb; // question-named files first
    return (rankOf.get(a.path) ?? 0) - (rankOf.get(b.path) ?? 0); // then lens bias
  });
}

// ── prompts ──────────────────────────────────────────────────────────────────

function answerMessages(
  architecture: string,
  question: string,
  reads: ReadFile[],
  lens?: IterativeLens,
  omitted = 0,
): ChatTurn[] {
  const examined = reads
    .map((r) => `### ${r.path} (${r.status})\n${r.summary ?? r.raw}`)
    .join('\n\n');
  const task = lens
    ? `Your task: ${lens.instruction}${lens.answerFormat ? `\n${lens.answerFormat}` : ''}\n\n`
    : 'You answer a question about a pull request using its architecture map and the files you examined. ';
  // Scope note in the PROTECTED head (truncation cuts from the tail) so a big-PR
  // answer can't silently claim completeness over files it never read.
  const scope =
    omitted > 0
      ? `You inspected the ${reads.length} most relevant changed files of ${reads.length + omitted}; if the answer may be incomplete, say so. `
      : '';
  const system = truncateToTokens(
    task +
      scope +
      'Be specific and cite the file paths you used. If the examined files do not fully answer it, say what is missing.\n\n' +
      `Architecture map:\n${architecture}` +
      (examined ? `\n\nFiles examined:\n${examined}` : ''),
    ANSWER_CONTEXT_TOKENS,
  );
  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

async function summarizeFile(
  brain: BrainRuntime,
  question: string,
  read: ReadFile,
  signal: AbortSignal,
  lens?: IterativeLens,
): Promise<string> {
  const focus = lens ? ` Focus on what matters for this task: ${lens.instruction}` : '';
  const messages: ChatTurn[] = [
    {
      role: 'system',
      content:
        'Summarize, in under 110 words of plain prose, what this file does and how it relates to the ' +
        `question. Keep concrete names (functions, types, exports). No preamble.${focus}`,
    },
    { role: 'user', content: `Question: ${question}\n\nFile ${read.path}:\n${read.raw}\n\nSummary:` },
  ];
  const out = (await brain.generate(messages, { signal, maxTokens: FILE_SUMMARY_TOKENS })).trim();
  return out || truncateToTokens(read.raw, FILE_SUMMARY_TOKENS);
}

// ── token budgeting helpers ──────────────────────────────────────────────────

function workingTokens(architecture: string, question: string, reads: ReadFile[]): number {
  let n = countTokens(architecture) + countTokens(question);
  for (const r of reads) n += countTokens(r.summary ?? r.raw);
  return n;
}

const countLines = (s: string): number => {
  let n = 1;
  for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) n++;
  return n;
};

/** Keep `text` within `maxTokens` by retaining its head and tail and eliding the
 *  middle (the cheap observation-cap goose applies to large tool outputs). Uses a
 *  SAMPLED token estimate + the sample's chars-per-token ratio, so a 256 KB file
 *  is never fully BPE-encoded on the main thread (aider's perf approach). */
export function capHeadTail(text: string, maxTokens: number): string {
  const est = estimateTokens(text);
  if (est <= maxTokens) return text;
  const charsPerTok = text.length / Math.max(1, est);
  const headChars = Math.max(0, Math.floor(maxTokens * 0.7 * charsPerTok));
  const tailChars = Math.max(0, Math.floor(maxTokens * 0.3 * charsPerTok));
  const head = text.slice(0, headChars);
  const tail = text.slice(text.length - tailChars);
  const elided = Math.max(0, countLines(text) - countLines(head) - countLines(tail));
  return `${head}\n… (${elided} lines elided) …\n${tail}`;
}
