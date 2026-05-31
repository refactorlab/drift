// Entry point for the AI-suggestion post step.
//
// This module owns the SINGLE Drift sticky comment reviewers see when AI
// suggestions are enabled. ALL code suggestions — the deterministic scanner
// findings (from DRIFT_REPORT_PATH) AND the top `maxAi` AI-refined ones (from
// AI_SUGGESTIONS_PATH) — render in that ONE comment's "Code suggestions"
// section. We deliberately do NOT post a second inline PR review: reviewers get
// a single comment, not two surfaces. main.ts defers the sticky comment to this
// step (`DRIFT_DEFER_STICKY_COMMENT=true`) so the comment can include the
// AI-refined suggestions, which don't exist yet at main.ts's step.
//
// Inputs (env):
//   AI_SUGGESTIONS_PATH        — path to the model's response file (optional;
//                                 if missing/empty the sticky is deterministic-only)
//   DRIFT_REPORT_PATH          — path to the scanner's JSON report (the
//                                 deterministic code_suggestions + the rest of
//                                 the overview the sticky re-renders)
//   DRIFT_MAX_AI_SUGGESTIONS   — hard cap on AI entries (default 1)
//   DRIFT_AI_MODEL             — model id, shown on each AI suggestion block
//   DRIFT_DRY_RUN              — "true" → render + log, don't POST
//   GITHUB_TOKEN               — auth (required unless DRIFT_DRY_RUN)
//   DRIFT_AUDIO_URL / DRIFT_AUDIO_MP4_URL / DRIFT_SCAN_JSON_URL /
//   DRIFT_SCAN_CONTEXT_URL     — footer/artifact links threaded into the sticky
//
// Failure policy: fail-soft. Any unrecoverable error logs a warning and
// exits 0; the check run (posted by main.ts) is the authoritative gate.

import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar, type ScanPrOutput } from './report.ts';
import { parseAIOutput } from './ai/parse.ts';
import { fetchPrFiles } from './ai/post.ts';
import { filterByDiff } from './ai/diff-lines.ts';
import { mergeAiSuggestionsIntoReport } from './ai/to-code-suggestion.ts';
import { buildAndUpsertSticky } from './github/sticky-post.ts';
import type { AISuggestion } from './ai/schema.ts';
import type { PrContext } from './render/context.ts';
import { resolvePrContext, type ResolvedPr } from './pr-context.ts';

type Octokit = ReturnType<typeof getOctokit>;

type AIFunnel = {
  total: number;       // raw entries the model emitted
  passing: number;     // cleared the AI quality bar (parseAIOutput)
};

async function aiMain(): Promise<void> {
  const model = process.env.DRIFT_AI_MODEL || 'openai/gpt-4o';
  const dryRun = process.env.DRIFT_DRY_RUN === 'true';
  const maxAi = parseMax(process.env.DRIFT_MAX_AI_SUGGESTIONS, 1);
  // main.ts defers the sticky comment to THIS step whenever AI suggestions are
  // enabled, so the comment can carry the AI-refined suggestions (which don't
  // exist yet at main.ts's step). This step then OWNS that single comment.
  const deferSticky = process.env.DRIFT_DEFER_STICKY_COMMENT === 'true';

  // Deterministic suggestions live in the report; AI suggestions in the
  // envelope. Both feed the ONE sticky comment. The AI envelope is optional —
  // a missing/failed AI loop just yields a deterministic-only sticky.
  const report = loadReportSafe();
  const { suggestions: aiSuggestions, funnel: aiFunnel } = readAISuggestions();

  // This step posts exactly ONE surface: the sticky comment. When main.ts owns
  // it instead (deferSticky unset — the AI-disabled path), there's nothing for
  // this step to do.
  if (!deferSticky) {
    core.info(
      'DRIFT_DEFER_STICKY_COMMENT not set — main.ts owns the sticky comment; this step has nothing to post.',
    );
    return;
  }
  if (!report) {
    // loadReportSafe already explained why; without it we can't render the overview.
    core.warning('Scan report unreadable — cannot refresh the sticky comment.');
    return;
  }

  const pr = resolvePrContext();
  if (!pr) {
    core.info('No PR context (pull_request payload or DRIFT_PR_* env vars) — skipping sticky comment.');
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token && !dryRun) {
    core.warning('No GITHUB_TOKEN — skipping sticky comment.');
    return;
  }
  const octokit = getOctokit(token || 'dry-run-stub-token');
  const { owner, repo } = context.repo;

  // One pulls.listFiles pass backs the AI merge: `commentable` keeps only AI
  // suggestions that anchor to a real diff line (so the reconstructed red/green
  // diff is exact), and `patches` is what reconstructDiff reads. Best-effort —
  // on failure the AI suggestion diffs degrade to after-only.
  let commentable: Map<string, Set<number>> | null = null;
  let patches: Map<string, string> | null = null;
  try {
    const f = await fetchPrFiles(octokit, owner, repo, pr.number);
    commentable = f.commentable;
    patches = f.patches;
  } catch (e) {
    core.warning(`Could not fetch PR diff (${describe(e)}); AI suggestion diffs will be after-only.`);
  }

  // AI: keep only on-diff suggestions, then cap to maxAi. The top `maxAi`
  // findings become the AI-refined "code suggestion" blocks; everything else
  // stays a deterministic row in the SAME sticky "Code suggestions" section.
  const aiOnDiff = filterAIByDiff(aiSuggestions, commentable);
  const aiPostable = aiOnDiff.slice(0, maxAi);

  // AI funnel — the diagnostic readers rely on to spot dropped AI entries.
  if (aiFunnel.total > 0) {
    core.info(
      `🤖 ${model}: ${aiFunnel.total} candidate(s) → ${aiFunnel.passing} pass quality bar → ` +
        `${aiOnDiff.length} on-diff → ${aiPostable.length} AI-refined (cap=${maxAi}).`,
    );
  }
  const detCount = (report.pr_review?.code_suggestions ?? []).filter(passesQualityBar).length;
  core.info(
    `🟣 Drift sticky comment: ${detCount} deterministic + ${aiPostable.length} AI-refined ` +
      `code suggestion(s) in ONE comment.`,
  );

  // The single surface: render the sticky with the AI-refined suggestions
  // merged into the report so they show in the "Code suggestions" section.
  try {
    await postDeferredSticky({ octokit, owner, repo, report, pr, aiPostable, patches, model, dryRun });
  } catch (e) {
    core.warning(`Sticky comment refresh failed (non-fatal): ${describe(e)}`);
  }
}

/**
 * Render + upsert the sticky comment with the AI-refined suggestions merged
 * into the report. Converts each postable AISuggestion into a CodeSuggestion
 * carrying a reconstructed red/green diff, dedupes against the deterministic
 * findings by `path:line` (AI wins — it's the one rendered with the rich
 * block), then delegates to the shared sticky helper.
 */
async function postDeferredSticky(args: {
  octokit: Octokit;
  owner: string;
  repo: string;
  report: ScanPrOutput | null;
  pr: ResolvedPr;
  aiPostable: AISuggestion[];
  patches: Map<string, string> | null;
  model: string;
  dryRun?: boolean;
}): Promise<void> {
  const { report, pr } = args;
  if (!report) {
    core.warning('Sticky comment deferred but the scan report is unreadable — cannot render the overview.');
    return;
  }

  // Convert + merge the AI suggestions into a copy of the report (pure helper,
  // unit-tested in ai-sticky-render.test.ts): each becomes a CodeSuggestion
  // with a reconstructed red/green diff, deduped against the deterministic
  // findings by path:line (AI wins). Empty aiPostable → deterministic-only;
  // null patches → after-only diffs.
  const mergedReport = mergeAiSuggestionsIntoReport(report, args.aiPostable, args.patches, args.model);

  const ctx: PrContext = {
    owner: args.owner,
    repo: args.repo,
    sha: pr.headSha,
    prNumber: pr.number,
    prTitle: pr.title,
    htmlUrl: pr.htmlUrl,
    baseRef: pr.baseRef,
    author: pr.author,
  };

  await buildAndUpsertSticky({
    octokit: args.octokit,
    owner: args.owner,
    repo: args.repo,
    prNumber: pr.number,
    report: mergedReport,
    ctx,
    audioUrl: optEnv('DRIFT_AUDIO_URL'),
    audioMp4Url: optEnv('DRIFT_AUDIO_MP4_URL'),
    scanJsonUrl: optEnv('DRIFT_SCAN_JSON_URL'),
    scanContextUrl: optEnv('DRIFT_SCAN_CONTEXT_URL'),
    dryRun: args.dryRun,
  });
  core.info(`Sticky comment refreshed with ${args.aiPostable.length} AI-refined suggestion(s) merged in.`);
}

function optEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

/** Apply the diff filter to AI suggestions, logging per-finding drop
 *  reasons. Returns the surviving AISuggestion[] (still uncapped). */
function filterAIByDiff(
  suggestions: AISuggestion[],
  commentable: Map<string, Set<number>> | null,
): AISuggestion[] {
  if (suggestions.length === 0) return [];
  if (!commentable) return suggestions;
  const { kept, dropped, reasons } = filterByDiff(suggestions, commentable);
  if (dropped.length) {
    core.info(`🤖 dropped ${dropped.length} suggestion(s) — per-finding reasons:`);
    for (let i = 0; i < dropped.length; i += 1) {
      const s = dropped[i];
      core.info(`  • ${s.file}:${s.line} — ${reasons[i] ?? 'unknown'}`);
    }
  }
  return kept;
}

/** Load the scan report from DRIFT_REPORT_PATH, or null when it's missing or
 *  unreadable. The caller derives the deterministic suggestions from it AND —
 *  when this step owns the sticky comment — re-renders the whole overview, so
 *  it needs the full report object, not just `code_suggestions`. */
function loadReportSafe(): ScanPrOutput | null {
  const path = process.env.DRIFT_REPORT_PATH;
  if (!path) {
    core.info('DRIFT_REPORT_PATH not set — combined review will skip deterministic suggestions.');
    return null;
  }
  try {
    return loadReport(path);
  } catch (e) {
    core.info(`Drift report unreadable at ${path}: ${describe(e)} — combined review will skip deterministic`);
    return null;
  }
}

/** Read + parse AI suggestions from AI_SUGGESTIONS_PATH. Returns the FULL
 *  quality-bar-passing list (NO cap yet — cap is applied after the diff
 *  filter so it counts POSTABLE entries) AND a funnel breakdown for
 *  diagnostic logging at the call site. */
function readAISuggestions(): { suggestions: AISuggestion[]; funnel: AIFunnel } {
  const empty: AIFunnel = { total: 0, passing: 0 };
  const path = process.env.AI_SUGGESTIONS_PATH;
  if (!path) {
    core.info('AI_SUGGESTIONS_PATH not set — combined review will skip AI.');
    return { suggestions: [], funnel: empty };
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    // ENOENT is the EXPECTED shape when the AI inference loop was skipped
    // (preflight blocked it: missing `models: read`, model unavailable, …) —
    // the loop is what creates the envelope. Frame it as a fallback, not a
    // crash; the deterministic suggestions below still post inline.
    if (isNotFound(e)) {
      core.info(
        `AI envelope not produced at ${path} (the AI inference step was skipped or failed) — ` +
          `posting deterministic suggestions only.`,
      );
    } else {
      core.info(`AI envelope unreadable at ${path}: ${describe(e)} — combined review will skip AI`);
    }
    return { suggestions: [], funnel: empty };
  }
  if (raw.trim().length === 0) {
    // Preserve the legacy "AI suggestions file is empty" breadcrumb — the
    // ai-suggest E2E test asserts it.
    core.info('AI suggestions file is empty — skipping AI half of combined review.');
    return { suggestions: [], funnel: empty };
  }
  const parsed = parseAIOutput(raw);
  if (!parsed.ok) {
    core.warning(`AI output rejected: ${parsed.reason}`);
    core.info(`first 400 chars:\n${parsed.rawPreview}`);
    return { suggestions: [], funnel: empty };
  }
  if (parsed.suggestions.length === 0) {
    core.info(
      `🤖 ${parsed.total} candidate(s) → 0 cleared the quality bar — silence > noise.`,
    );
    return {
      suggestions: [],
      funnel: { total: parsed.total, passing: parsed.passing },
    };
  }
  return {
    suggestions: parsed.suggestions,
    funnel: { total: parsed.total, passing: parsed.passing },
  };
}

function parseMax(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** True for a "file does not exist" error (Node sets `code === 'ENOENT'`). */
function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'ENOENT';
}

aiMain().catch((err) => {
  // Fail-soft at the top level.
  core.warning(`Unhandled combined-review error: ${describe(err)}`);
});
