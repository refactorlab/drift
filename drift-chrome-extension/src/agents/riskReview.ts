// The QUALITATIVE risk review — what a principal engineer actually says in review,
// not a table of scores. Ranks/labels from the scan don't carry the insight; the
// reasoning does: is the logic sound, what breaks downstream, what could be better.
//
// A MAP → REDUCE → VERIFY pipeline (so it scales to any PR size and stays precise):
//   • MAP    — one focused brain pass PER changed file: read its diff + the scanner
//              leads for it, emit concrete (confirmed/possible) findings with a trigger.
//   • REDUCE — synthesize the per-file notes + PR intent + call graph into the review.
//   • VERIFY — (text, gated) prune false-positive "Confirmed" findings.
// The scan's numbers are demoted to a TARGETING SYSTEM: buildIntentContext (author's
// intent), buildBlastContext (call-graph breakage surface), and the brief's concrete
// findings seed the passes; the deterministic brief (riskBrief.ts) is the graceful
// FALLBACK when nothing is readable.
//
// The prompt design follows MEASURED 2024-2026 evidence (see the prompt block below):
// few-shot, require a concrete trigger + split confirmed/possible, an explicit
// "Looks correct" escape hatch, no over-elaboration, and spend extra passes on
// VERIFICATION not generation. Pure builders + prompt builders are unit-tested.

import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';
import { capHeadTail, groundCitations, READ_CONTENT_TOKENS, READ_DIFF_TOKENS, type ReadableFile } from './iterative-agent';
import { isSource, isTest } from './lenses';
import { normalizeFlowchart } from '../core/changeImpactGraph';
import { asScanOutput } from '../core/scanOutput';
import { buildRiskBrief, formatRiskBrief, type RiskBrief, type BriefFinding } from './riskBrief';
import { listPrFiles, getPrFile } from '../state/prFileStore';
import { truncateToTokens } from '../core/chatContext';
import { collectFileDiff } from './changeCollector';
import type { PrId } from '../core/prRefs';

const CHANGED_CLASSES = new Set(['added', 'changed', 'removed']);
/** Max changed symbols shown in the blast-radius context (highest fan-in first). */
const BLAST_CAP = 8;
/** Max hotspot leads fed to the brain. */
const HOTSPOT_CAP = 8;

const fileOf = (where: string): string => where.split(':')[0].trim();

function dedupCap(xs: string[], n: number): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const k = x.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= n) break;
  }
  return out.join(', ');
}

/**
 * The call-graph blast radius as prose the brain can reason over: for each CHANGED
 * symbol, who calls it (breaks if its contract changes) and what it calls. This is
 * the grounding the file-by-file lenses lack — it lets the review say "changing
 * foo() affects A, B, C" instead of guessing. Empty string when the scan carries no
 * structured call graph (the brain then reasons from code alone).
 */
export function buildBlastContext(scan: unknown, cap = BLAST_CAP): string {
  const structured = asScanOutput(scan)?.pr_review?.architecture_flow?.diff_merged_structured;
  if (!structured) return '';
  const graph = normalizeFlowchart(structured);
  if (!graph.nodes.length) return '';
  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const rows = graph.nodes
    .filter((n) => n.cls && CHANGED_CLASSES.has(n.cls))
    .map((n) => ({
      node: n,
      callers: graph.edges.filter((e) => e.to === n.id).map((e) => labelOf.get(e.from) ?? e.from),
      callees: graph.edges.filter((e) => e.from === n.id).map((e) => labelOf.get(e.to) ?? e.to),
    }))
    .filter((r) => r.callers.length || r.callees.length)
    .sort((a, b) => b.callers.length - a.callers.length);
  if (!rows.length) return '';
  const body = rows
    .slice(0, cap)
    .map((r) => {
      const parts: string[] = [];
      if (r.callers.length) parts.push(`called by ${dedupCap(r.callers, 5)} (these break if its contract changes)`);
      if (r.callees.length) parts.push(`calls ${dedupCap(r.callees, 4)}`);
      return `- ${r.node.label} [${r.node.cls}] — ${parts.join('; ')}`;
    })
    .join('\n');
  // Honesty cue (research-backed): a static call graph is a LOWER BOUND on the true
  // breakage surface — dynamic/reflective edges are silently missed — so the model
  // must not treat "no listed callers" as "safe". Travels with the context.
  return `${body}\n${BLAST_CAVEAT}`;
}

/** Appended to every blast-radius context — keeps the model from reading the caller
 *  set as complete (static call graphs miss eval/bind/apply/dynamic dispatch). */
export const BLAST_CAVEAT =
  '(Caller lists are from the STATIC call graph — a lower bound. Dynamic/reflective calls (eval, bind/apply, dynamic dispatch, DI) are not captured, so absent callers do NOT mean safe.)';

/** Tokens of the PR description fed as intent context. */
const INTENT_DESC_TOKENS = 300;

/**
 * The PR's stated INTENT — title, description, commit subjects — so the review can
 * (a) summarize what the change does in business-logic terms and (b) check the code
 * actually matches the intent (catch silent scope creep). The author's words, not
 * the scanner's metrics.
 */
export function buildIntentContext(rec: ScanRecord): string {
  const lines: string[] = [];
  if (rec.title) lines.push(`Title: ${rec.title}`);
  const desc = (rec.description ?? asScanOutput(rec.scan)?.pr_description ?? '').trim();
  if (desc) lines.push(`Description: ${truncateToTokens(desc, INTENT_DESC_TOKENS)}`);
  const commits = (rec.commits ?? []).map((c) => c.split('\n', 1)[0].trim()).filter(Boolean);
  if (commits.length) lines.push(`Commits: ${commits.slice(-6).join('; ')}`);
  return lines.join('\n');
}

/**
 * The scanner's CONCRETE findings (a specific issue at a file:line) as LEADS to
 * verify in the diff — NOT the aggregate risk LABELS ("wide blast radius", "N roots
 * lack retry/timeout", "N uncovered roots"). Those are statistics, not logical
 * risks, and feeding them is exactly what made the review parrot metrics instead of
 * reading the code. Capped; deduped on the rendered line.
 */
export function buildHotspotContext(brief: RiskBrief): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of brief.findings) {
    if (!f.message) continue;
    const where = f.where ? ` (${f.where})` : '';
    const cat = f.category ? `${f.category}: ` : '';
    const line = `- ${cat}${f.message}${where}`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= HOTSPOT_CAP) break;
  }
  return out.join('\n');
}

// ── prompts (grounded in MEASURED 2024-2026 evidence) ────────────────────────
// What the research actually supports (and what it warns against):
//  • Few-shot a GOOD vs BAD finding — the single biggest lever (46–659% EM gain).
//  • Require a CONCRETE TRIGGER (the input→bad-output that proves it) and split
//    "confirmed" from "possible": ~87% of an LLM's false rejections are hallucinated
//    reasoning (logic/boundary/added-requirement/misread). A trigger requirement +
//    an explicit "Looks correct" escape hatch counter that over-rejection.
//  • Do NOT pile on "explain everything + propose fixes" — measured to RAISE false
//    rejections sharply (it talks the model into inventing problems). Keep it tight.
//  • Spend extra passes on VERIFICATION, not more generation — a dedicated
//    false-positive filter lifted label accuracy 53%→86% and cut >85% of FPs.
//  • Constrain output: no rewrites, real symbols only, no generated code.

/** Per-file MAP note budget — kept small so the REDUCE input stays bounded at any PR size. */
const MAP_NOTE_TOKENS = 240;
/** Final review + verify budgets. */
const REDUCE_TOKENS = 700;
const VERIFY_TOKENS = 700;
/** Total per-file notes fed to REDUCE — capped, so a 200-file PR still reduces in one pass. */
const REDUCE_NOTES_TOKENS = 1600;
/** Files individually reviewed in MAP (ranked; the rest are noted as not-reviewed). */
const MAP_FILE_CAP = 6;

const MAP_SYSTEM =
  'You are reviewing the change to ONE file in a pull request. Report ONLY concrete problems you can confirm in the ' +
  'diff shown — never invent issues, never propose rewrites, name only symbols that appear in the code, and do not ' +
  'output any code.\n' +
  'For each problem write one line: the concern, the file:line, and a CONCRETE TRIGGER — the specific input or ' +
  'sequence of events that makes it go wrong. End the line with "(confirmed)" if you can state a real trigger, or ' +
  '"(possible)" if you only suspect it. If the change looks correct, reply with exactly: Looks correct.\n' +
  'Check the diff for: null/empty/error/timeout and the unhappy path; off-by-one and boundaries; async or ' +
  'concurrent state — a race, a missing await, an unhandled rejection; whether it matches the stated intent ' +
  '(scope creep); and hot-path cost or needless complexity.\n' +
  'The two lines below show only the FORMAT. They are NOT findings about this file — never copy their wording, ' +
  'their "off-by-one/rows" content, or their file name "Member.tsx"/line numbers. Cite ONLY this file and report ' +
  'ONLY what is actually in its diff; if nothing is wrong, reply exactly: Looks correct.\n' +
  'GOOD finding (format only): "- Off-by-one in the render loop: `i <= rows.length` reads `rows[rows.length]` ' +
  '(undefined) → blank-row crash (Member.tsx:42) (confirmed: rows=[a] reads rows[1])".\n' +
  'BAD — never write: "- This function is complex and may be risky." (no concrete trigger → omit it).';

export function mapMessages(intent: string, file: ReadableFile, fileFindings: string, change: string): ChatTurn[] {
  const intentLine = intent ? `PR intent:\n${intent}\n\n` : '';
  const leads = fileFindings ? `Scanner leads for this file (verify in the diff, or dismiss):\n${fileFindings}\n\n` : '';
  return [
    { role: 'system', content: MAP_SYSTEM },
    { role: 'user', content: `${intentLine}File: ${file.path} (${file.status})\n\n${leads}The change:\n${change}\n\nFindings:` },
  ];
}

function reduceSystem(voice: boolean): string {
  const format = voice
    ? 'Write a SHORT spoken review, 5–7 sentences, no headers and no bullet points: what the PR changes in plain ' +
      'terms; the main thing that could break (with the specific code reason); anything not optimal; then the single ' +
      'most important thing to fix before merge.'
    : 'Structure the review:\n' +
      '**What this PR changes** — 2–4 plain sentences (the behavior/flow/feature), from the intent and notes. No metrics.\n' +
      '**What could break** — two groups: "Confirmed" (a concrete trigger exists in the notes) and "Worth checking" ' +
      '(possible/unverified). Each cites file:line; for a breaking change, name the caller from the call graph that ' +
      'would break. If nothing is confirmed, say so plainly.\n' +
      "**What's not optimal** — performance, needless complexity, or a simpler/safer approach (NON-blocking).\n" +
      "End with one line: 'Most important before merge: …', or 'Nothing blocks merge.'";
  return (
    'You are a senior engineer writing the FINAL risk review of a pull request from the per-file review notes below. ' +
    'Use ONLY what the notes support — do NOT introduce new problems, and do NOT recite scanner metrics (blast ' +
    'radius, root counts, complexity counts). Preserve each note’s (confirmed)/(possible) status.\n' +
    format
  );
}

export function reduceMessages(intent: string, perFileNotes: string, blast: string, omittedNote: string, voice: boolean): ChatTurn[] {
  const body = [
    intent && `PR intent:\n${intent}`,
    `Per-file review notes:\n${perFileNotes}`,
    blast && `Call graph (who depends on the changed code — for breaking-change reasoning):\n${blast}`,
    omittedNote,
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    { role: 'system', content: reduceSystem(voice) },
    { role: 'user', content: body },
  ];
}

const VERIFY_SYSTEM =
  'You are pruning a draft risk review for FALSE POSITIVES — the top reason reviews get ignored. For each item ' +
  'under "Confirmed", keep it ONLY if its concrete trigger is actually supported by the per-file notes; otherwise ' +
  'move it to "Worth checking" or delete it. Delete anything out of scope or not grounded in the notes. Do NOT add ' +
  'anything new and do NOT touch the other sections. Return the corrected review in the same format.';

export function verifyMessages(draft: string, perFileNotes: string): ChatTurn[] {
  return [
    { role: 'system', content: VERIFY_SYSTEM },
    { role: 'user', content: `Per-file notes:\n${perFileNotes}\n\nDraft review:\n${draft}\n\nCorrected review:` },
  ];
}

/** Run the verify pass only when there is something to prune (a "Confirmed" item)
 *  AND the draft is substantial — it costs a brain call, so skip clean/short drafts. */
export function needsVerify(draft: string): boolean {
  return /(^|\n)\s*\*{0,2}confirmed/i.test(draft) && draft.trim().length > 120;
}

/** Rank changed files for the MAP phase: scanner-flagged hot files first, then
 *  source, then the rest — so the per-file budget is spent on the riskiest code. */
export function rankFilesForRisk(files: ReadableFile[], hotFiles: Set<string>): ReadableFile[] {
  const score = (f: ReadableFile): number => (hotFiles.has(f.path) ? 4 : 0) + (isSource(f.path) ? 2 : isTest(f.path) ? 1 : 0);
  return files
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

/** The scanner findings located IN a file — its leads for the MAP pass. */
export function findingsForFile(findings: BriefFinding[], path: string): string {
  return findings
    .filter((fd) => fd.where.split(':')[0].trim() === path)
    .map((fd) => `- ${fd.category ? `${fd.category}: ` : ''}${fd.message}${fd.where ? ` (${fd.where})` : ''}`)
    .join('\n');
}

/** A source-file citation inside a finding line — `Member.tsx:42`, `src/a/b.ts`, etc.
 *  Restricted to known code extensions so prose like `rows.length` or `session.close()`
 *  is NOT mistaken for a file reference. */
const FILE_CITATION =
  /\b([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|json|md|css|scss|html|py|rs|go|java|rb|c|cpp|h|sh|ya?ml|toml))\b/g;

const baseOf = (p: string): string => p.split('/').pop() ?? p;

/**
 * Drop MAP findings that cite a file OTHER than the one under review (and not among the
 * PR's changed files). A per-file pass reviews ONE file's diff, so a line citing some other
 * file is the model parroting the prompt's few-shot example ("Member.tsx off-by-one") or
 * hallucinating cross-file — the exact bug that surfaced fake findings. Lines that cite the
 * reviewed file, a real changed file, or no file at all are kept. Returns '' if every line
 * is dropped (the whole note was fabricated).
 */
export function groundMapNote(note: string, path: string, changed: Set<string>): string {
  const base = baseOf(path);
  const known = new Set([...changed].map(baseOf));
  const lineOk = (line: string): boolean => {
    const cited = [...line.matchAll(FILE_CITATION)].map((m) => m[1]);
    if (!cited.length) return true; // no file reference → a general note, keep
    return cited.every((c) => {
      const cb = baseOf(c);
      return cb === base || c === path || changed.has(c) || known.has(cb);
    });
  };
  return note
    .split('\n')
    .filter((l) => !l.trim() || lineOk(l))
    .join('\n')
    .trim();
}

/** Read a changed file's diff + content from the scan cache, capped head+tail. The
 *  DIFF leads — it is the heart of a "what could break" judgement. */
async function readChange(rec: ScanRecord, pr: PrId | undefined, file: ReadableFile, signal: AbortSignal): Promise<string | null> {
  const got = await getPrFile(rec.url, rec.sha, file.path).catch(() => null);
  // The scan caches diffs BEST-EFFORT and evicts old shas (MAX_SHAS_PER_PR), so a scan
  // restored from history routinely has an empty cache. When the cached diff is missing,
  // COLLECT it from GitHub's `.diff` (memoized) instead of skipping the file — skipping is
  // exactly what starved the brain of code and silently fell back to the deterministic
  // brief ("very unhelpful text"). Mirrors handover's loadFileSections.
  let diffText = got?.diff?.trim() ?? '';
  if (!diffText && pr) {
    diffText = (await collectFileDiff({ pr, url: rec.url, sha: rec.sha, path: file.path, signal }).catch(() => '')).trim();
  }
  const diff = diffText ? `--- the change (− removed · + added) ---\n${capHeadTail(diffText, READ_DIFF_TOKENS)}` : '';
  const content = got?.content?.trim() ? `--- file content ---\n${capHeadTail(got.content, READ_CONTENT_TOKENS)}` : '';
  const note = !diffText && got?.content?.trim() ? '\n(No line diff cached; the content above is the current state.)' : '';
  const body = `${[diff, content].filter(Boolean).join('\n\n')}${note}`.trim();
  return body || null;
}

function verdictHeader(brief: RiskBrief): string {
  const conf = brief.mergeConfidence != null ? ` (merge confidence ${brief.mergeConfidence}/5)` : '';
  return `Verdict: ${brief.verdictLabel}${conf}.`;
}

export interface RiskReviewOpts {
  rec: ScanRecord;
  brain: BrainRuntime;
  /** The PR identity — lets MAP collect a file's diff from GitHub when the scan's
   *  best-effort file cache was evicted, so the brain always reviews REAL code instead
   *  of falling back to the deterministic brief. Omit and only the cache is used. */
  pr?: PrId;
  /** Restrict the review to these paths (the handover's CURRENT file) — MAP reviews only
   *  them and the result is framed as a per-file review. Omitted → the whole PR is reviewed. */
  focusPaths?: string[];
  /** The user's question (frames the answer; unused for file selection now). */
  userText: string;
  signal: AbortSignal;
  onProgress?: (note: string) => void;
  /** Voice gets a concise spoken format; text gets the labelled sections. */
  mode?: 'text' | 'voice';
}

export interface RiskReviewResult {
  content: string;
  readPaths: string[];
  verdict: 'address' | 'review';
}

/**
 * The grounded qualitative risk review as a MAP → REDUCE → VERIFY pipeline:
 *
 *   MAP    — one focused pass PER changed file: read its diff + the scanner leads
 *            for it, and emit concrete (confirmed/possible) findings, each with a
 *            trigger. This is where the extra "brain" goes — N small grounded passes.
 *   REDUCE — one synthesis pass turns the per-file notes + intent + call graph into
 *            the final review, adding nothing the notes don't support.
 *   VERIFY — (text mode, only when there's a Confirmed item) prune false positives.
 *
 * Scales to any PR: notes are tiny, so REDUCE input stays bounded no matter how many
 * files; the MAP is capped to the riskiest MAP_FILE_CAP and the rest are flagged as
 * not individually reviewed (never silently dropped). Falls back to the deterministic
 * brief if nothing is readable, so a risk question is never met with silence.
 */
export async function runRiskReview(opts: RiskReviewOpts): Promise<RiskReviewResult> {
  const { rec, brain, signal, mode } = opts;
  const voice = mode === 'voice';
  const progress = opts.onProgress ?? (() => {});
  const brief = buildRiskBrief(rec.scan);
  const intent = buildIntentContext(rec);
  const blast = buildBlastContext(rec.scan);

  // The file cache is best-effort + evicts old shas — when it's empty (a scan restored from
  // history whose files were evicted), fall back to the scan record's changed-file list so
  // the brain still reviews the change; readChange then collects each diff from GitHub on
  // demand. Without this the MAP loop read zero files and no-oped straight to the brief dump.
  const cached = (await listPrFiles(rec.url, rec.sha).catch(() => [])) as ReadableFile[];
  const all: ReadableFile[] = cached.length
    ? cached
    : (rec.changedStatus ?? []).map((c) => ({ path: c.path, status: c.code }));
  const hotFiles = new Set((brief?.findings ?? []).map((f) => fileOf(f.where)).filter(Boolean));
  const ranked = rankFilesForRisk(all, hotFiles);
  // SCOPE: a file-scoped review (the handover's current file) restricts MAP to focusPaths;
  // if the cache doesn't list them, review them straight from the path. Empty → whole PR.
  const scopedReview = !!opts.focusPaths?.length;
  const pool = scopedReview
    ? ((): ReadableFile[] => {
        const want = new Set(opts.focusPaths);
        const hit = ranked.filter((f) => want.has(f.path));
        return hit.length ? hit : opts.focusPaths!.map((p) => ({ path: p, status: 'M' }));
      })()
    : ranked;
  const picked = pool.slice(0, MAP_FILE_CAP);
  const omitted = pool.length - picked.length;
  const changedPaths = new Set(all.map((f) => f.path));
  // A file-scoped review must NOT lead with the PR-level verdict/merge-confidence — that
  // header is about the whole PR, not this file. Whole-PR reviews keep it.
  const header = scopedReview ? '' : brief ? verdictHeader(brief) : '';

  // ── MAP: a focused, grounded pass per changed file ──
  const notes: string[] = [];
  const readPaths: string[] = [];
  for (const f of picked) {
    if (signal.aborted) break;
    progress(`reviewing ${f.path}…`);
    const change = await readChange(rec, opts.pr, f, signal);
    if (!change) continue;
    readPaths.push(f.path);
    const fileFindings = findingsForFile(brief?.findings ?? [], f.path);
    const raw = (await brain.generate(mapMessages(intent, f, fileFindings, change), { signal, maxTokens: MAP_NOTE_TOKENS }).catch(() => '')).trim();
    // Strip findings that cite some OTHER file — the model parroting the prompt's example
    // or hallucinating cross-file. A fully-fabricated note collapses to '' and is skipped.
    const note = groundMapNote(raw, f.path, changedPaths);
    if (note && !/^looks correct\.?$/i.test(note)) notes.push(`### ${f.path}\n${note}`);
  }

  // Nothing flagged (every file looked correct, or none readable) → grounded, honest answer.
  if (!notes.length) {
    if (scopedReview) {
      // File-scoped: never dump the whole-PR brief — answer about THESE files only.
      const names = picked.map((f) => baseOf(f.path)).join(', ') || 'the file';
      const clean = readPaths.length
        ? `Reviewed ${names} — no concrete logical risks found in the change.`
        : `I couldn't read the change in ${names} to review it — re-scan the PR and ask again.`;
      return { content: clean, readPaths, verdict: brief?.verdict ?? 'review' };
    }
    const clean = readPaths.length
      ? `Reviewed the changed file(s) — no concrete logical risks found in the diffs.${brief ? `\n\n${formatRiskBrief(brief).content}` : ''}`
      : brief
        ? formatRiskBrief(brief).content
        : 'No reviewable changes were found.';
    return { content: header && !clean.startsWith('Verdict:') ? `${header}\n\n${clean}` : clean, readPaths, verdict: brief?.verdict ?? 'review' };
  }

  const perFileNotes = truncateToTokens(notes.join('\n\n'), REDUCE_NOTES_TOKENS);
  const omittedNote = omitted > 0 ? `(${omitted} more changed file(s) were not individually reviewed — note the review may be incomplete.)` : '';

  // ── REDUCE: synthesize the final review from the notes ──
  progress('synthesizing the review…');
  let review = (await brain.generate(reduceMessages(intent, perFileNotes, blast, omittedNote, voice), { signal, maxTokens: REDUCE_TOKENS }).catch(() => '')).trim();

  // ── VERIFY: prune ungrounded "Confirmed" findings (precision pass) ──
  if (!voice && !signal.aborted && needsVerify(review)) {
    progress('checking findings…');
    const pruned = (await brain.generate(verifyMessages(review, perFileNotes), { signal, maxTokens: VERIFY_TOKENS }).catch(() => '')).trim();
    if (pruned.length > 80) review = pruned;
  }

  if (!review) review = brief ? formatRiskBrief(brief).content : 'No review was produced.';
  review = groundCitations(review, all);
  const content = header && !review.startsWith('Verdict:') ? `${header}\n\n${review}` : review;
  return { content, readPaths, verdict: brief?.verdict ?? 'review' };
}
