// Build the AI prompt context from the scanner's report + the PR diff.
//
// Strategy: the scanner already tells us *which files* and *which lines*
// matter via `pr_review.code_suggestions[]`. We use those as FOCAL
// POINTS — for each one we emit:
//   - file:line + function + category + scanner's why_it_matters
//   - llm_prompt_hint (the scanner pre-prepared a hint for the LLM)
//   - the scanner's existing references[]
//   - a window of source code around the line (read from $GITHUB_WORKSPACE)
//
// When code_suggestions is empty (the Rust scanner doesn't always
// populate it), we fall back to the deterministic pr_scope signal
// + the raw PR diff.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parsePatch } from 'diff';
import type { CodeSuggestion, ScanPrOutput } from '../report.ts';
import { loadReport } from '../report.ts';

export type BuildContextArgs = {
  reportPath: string;        // scanner's JSON output
  workspaceRoot: string;     // $GITHUB_WORKSPACE (checkout root)
  baseSha: string;
  headSha: string;
  maxFiles: number;          // cap diff file count
  maxFocalPoints: number;    // cap focal-point sections
  byteBudget: number;        // overall context cap (default 80 KB)
};

export type BuildContextResult = {
  text: string;
  bytes: number;
  focalPoints: number;
  diffFiles: number;
  source: 'focal+diff' | 'diff-fallback';
  // Diagnostics — surfaced so an empty result is debuggable from the logs.
  reportLoaded: boolean;
  codeSuggestionsInReport: number;
  diffStrategy: 'three-dot' | 'two-dot' | 'none';
};

const CODE_WINDOW_BEFORE = 8;
const CODE_WINDOW_AFTER = 6;

export function buildAIContext(args: BuildContextArgs): BuildContextResult {
  const {
    reportPath,
    workspaceRoot,
    baseSha,
    headSha,
    maxFiles,
    maxFocalPoints,
    byteBudget,
  } = args;

  const sections: string[] = [];
  sections.push(`Head SHA: ${headSha}`);
  sections.push(`Base SHA: ${baseSha}`);
  sections.push('');

  let report: ScanPrOutput | null = null;
  try {
    if (existsSync(reportPath)) report = loadReport(reportPath);
  } catch {
    // Fall through — report is optional context.
  }

  const codeSuggestionsInReport = report?.pr_review?.code_suggestions?.length ?? 0;
  const focalSuggestions = pickFocalSuggestions(report, maxFocalPoints);
  const source: BuildContextResult['source'] =
    focalSuggestions.length > 0 ? 'focal+diff' : 'diff-fallback';

  // ── Scanner scope (always emitted when present) ────────────────────
  if (report) {
    sections.push('=== Scanner pr_scope (deterministic call-graph) ===');
    sections.push(
      JSON.stringify(
        {
          changed_files: report.pr_scope.changed_files,
          affected_roots: report.pr_scope.affected_roots,
          unreachable_changes: report.pr_scope.unreachable_changes,
        },
        null,
        2,
      ),
    );
    sections.push('');
  }

  // ── Focal points (scanner-flagged spots) ───────────────────────────
  if (focalSuggestions.length > 0) {
    sections.push(
      `=== Focal points (${focalSuggestions.length} scanner-flagged location${focalSuggestions.length === 1 ? '' : 's'}) ===`,
    );
    sections.push(
      'Refine or extend these. Each AI suggestion you emit MUST be',
      'on a line present in the diff hunks at the bottom of this file.',
      '',
    );
    focalSuggestions.forEach((s, i) => {
      sections.push(renderFocalPoint(s, i + 1, workspaceRoot));
      sections.push('');
    });
  }

  // ── PR diff (filtered to focal files, new-side lines numbered) ─────
  // The leading number on each line is the NEW-FILE line number — the
  // value to put in a suggestion's `line`/`start_line`. This is the
  // PR-Agent technique: LLMs count lines unreliably, so we hand them
  // the numbers. Lines marked `+` are new code (prefer these); `-`
  // lines are deletions (no number, never commentable).
  const focalFiles = new Set(focalSuggestions.map((s) => s.file));
  const diff = getPrDiff(workspaceRoot, baseSha, headSha, maxFiles, focalFiles);
  if (diff.text) {
    sections.push(
      `=== PR diff (${diff.fileCount} file${diff.fileCount === 1 ? '' : 's'}; ` +
        `each line is prefixed with its new-file line number) ===`,
    );
    sections.push(annotateDiff(diff.text));
  } else {
    sections.push('=== PR diff ===');
    sections.push('(no diff available — `git diff` failed)');
  }

  // ── Cap to byteBudget ──────────────────────────────────────────────
  let text = sections.join('\n');
  if (text.length > byteBudget) {
    text = text.slice(0, byteBudget) + `\n\n[truncated at ${byteBudget} bytes]\n`;
  }

  return {
    text,
    bytes: text.length,
    focalPoints: focalSuggestions.length,
    diffFiles: diff.fileCount,
    source,
    reportLoaded: report !== null,
    codeSuggestionsInReport,
    diffStrategy: diff.strategy,
  };
}

// ── helpers ───────────────────────────────────────────────────────────

/**
 * Re-emit a unified diff with the NEW-FILE line number prefixed on each
 * non-deletion line (PR-Agent's "numbered new hunk" technique). Parsing
 * is delegated to jsdiff; on any parse error we fail safe to the raw
 * diff so the model still sees *something*.
 */
export function annotateDiff(diffText: string): string {
  let files: ReturnType<typeof parsePatch>;
  try {
    files = parsePatch(diffText);
  } catch {
    return diffText;
  }
  const out: string[] = [];
  for (const file of files) {
    const name = (file.newFileName || file.oldFileName || 'file').replace(/^[ab]\//, '');
    out.push(`### ${name}`);
    for (const hunk of file.hunks) {
      out.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      let n = hunk.newStart;
      const pad = String(hunk.newStart + hunk.newLines).length;
      for (const row of hunk.lines) {
        const c = row[0];
        const code = row.slice(1);
        if (c === '+') {
          out.push(`${String(n).padStart(pad)} +${code}`);
          n += 1;
        } else if (c === ' ') {
          out.push(`${String(n).padStart(pad)}  ${code}`);
          n += 1;
        } else if (c === '-') {
          out.push(`${' '.repeat(pad)} -${code}`); // deletion: no new-side number
        }
        // '\' (no-newline marker) is dropped
      }
    }
  }
  return out.join('\n');
}

export function pickFocalSuggestions(
  report: ScanPrOutput | null,
  max: number,
): CodeSuggestion[] {
  if (!report || !report.pr_review || !report.pr_review.code_suggestions) {
    return [];
  }
  // Sort by descending confidence so the most-actionable items survive
  // the cap.
  const sorted = [...report.pr_review.code_suggestions]
    .filter((s) => typeof s.line === 'number' && s.file)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return sorted.slice(0, Math.max(0, max));
}

export function renderFocalPoint(
  s: CodeSuggestion,
  ordinal: number,
  workspaceRoot: string,
): string {
  const lines: string[] = [];
  const fn = s.function ? ` · function \`${s.function}\`` : '';
  lines.push(`[${ordinal}] ${s.file}:${s.line ?? '?'}${fn}`);
  lines.push(`    category: ${s.category}${s.category_label ? ` — ${s.category_label}` : ''}`);
  lines.push(`    scanner_confidence: ${s.confidence}`);
  lines.push(`    why: ${oneLine(s.why_it_matters)}`);

  // Scanner-provided LLM hint — the scanner pre-prepared a prompt
  // specifically for this finding. Surface it verbatim.
  const sExt = s as CodeSuggestion & {
    llm_prompt_hint?: string;
    remediation_hint?: string;
    rule_id?: string;
  };
  if (sExt.rule_id) lines.push(`    rule_id: ${sExt.rule_id}`);
  if (sExt.remediation_hint) {
    lines.push(`    remediation_hint: ${oneLine(sExt.remediation_hint)}`);
  }
  if (sExt.llm_prompt_hint) {
    lines.push(`    llm_prompt_hint: ${oneLine(sExt.llm_prompt_hint)}`);
  }

  if (s.references && s.references.length) {
    lines.push('    references:');
    for (const r of s.references.slice(0, 3)) {
      lines.push(`      - ${r.title ?? r.url} <${r.url}>`);
    }
  }

  // Code window read from the checked-out workspace (HEAD).
  const codeWindow = readCodeWindow(
    workspaceRoot,
    s.file,
    s.line,
    CODE_WINDOW_BEFORE,
    CODE_WINDOW_AFTER,
  );
  if (codeWindow) {
    lines.push('    code window (HEAD):');
    lines.push(indent(codeWindow, '      '));
  }

  return lines.join('\n');
}

function readCodeWindow(
  workspaceRoot: string,
  file: string,
  line: number | undefined,
  before: number,
  after: number,
): string | null {
  if (typeof line !== 'number') return null;
  const abs = resolve(workspaceRoot, file);
  if (!existsSync(abs)) return null;
  let raw: string;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
  const all = raw.split('\n');
  const start = Math.max(1, line - before);
  const end = Math.min(all.length, line + after);
  const padW = String(end).length;
  const out: string[] = [];
  for (let i = start; i <= end; i += 1) {
    const marker = i === line ? '←' : ' ';
    out.push(`${String(i).padStart(padW)}│${marker} ${all[i - 1] ?? ''}`);
  }
  return out.join('\n');
}

export function getPrDiff(
  workspaceRoot: string,
  baseSha: string,
  headSha: string,
  maxFiles: number,
  focalFiles: Set<string>,
): { text: string; fileCount: number; strategy: 'three-dot' | 'two-dot' | 'none' } {
  // Three-dot (`base...head`) is what GitHub's "Files changed" uses, but it
  // needs the merge-base commit — absent on the shallow clones actions/checkout
  // produces, which fails with "no merge base". Two-dot (`base..head`) diffs
  // the two endpoints directly and only needs both commit objects present
  // (our fetch step guarantees that). Try three-dot for fidelity, fall back.
  const names = gitDiffNames(workspaceRoot, baseSha, headSha);
  if (!names) return { text: '', fileCount: 0, strategy: 'none' };

  // Prefer focal files; pad with other changed files until we hit max.
  const prioritized: string[] = [];
  for (const n of names.files) if (focalFiles.has(n)) prioritized.push(n);
  for (const n of names.files) {
    if (!focalFiles.has(n) && prioritized.length < maxFiles) prioritized.push(n);
  }
  const slice = prioritized.slice(0, maxFiles);
  if (slice.length === 0) return { text: '', fileCount: 0, strategy: names.strategy };

  const range = names.strategy === 'three-dot' ? `${baseSha}...${headSha}` : `${baseSha}..${headSha}`;
  try {
    const args = ['diff', '--unified=5', range, '--', ...slice];
    const text = execFileSync('git', args, { cwd: workspaceRoot, encoding: 'utf8' });
    return { text, fileCount: slice.length, strategy: names.strategy };
  } catch {
    return { text: '', fileCount: 0, strategy: names.strategy };
  }
}

/**
 * `git diff --name-only` with a three-dot→two-dot fallback. Returns the
 * file list plus which range strategy actually succeeded (so the diff
 * step below uses the same one).
 */
function gitDiffNames(
  workspaceRoot: string,
  baseSha: string,
  headSha: string,
): { files: string[]; strategy: 'three-dot' | 'two-dot' } | null {
  for (const [sep, strategy] of [['...', 'three-dot'], ['..', 'two-dot']] as const) {
    try {
      const raw = execFileSync(
        'git',
        ['diff', '--name-only', `${baseSha}${sep}${headSha}`],
        { cwd: workspaceRoot, encoding: 'utf8' },
      );
      return { files: raw.split('\n').map((s) => s.trim()).filter(Boolean), strategy };
    } catch {
      // try the next separator
    }
  }
  return null;
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((l) => prefix + l)
    .join('\n');
}
