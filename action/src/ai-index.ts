// Entry point for the combined-suggestion post step.
//
// This module owns the SINGLE inline PR review that reviewers see.
// Both deterministic scanner suggestions (from DRIFT_REPORT_PATH) AND
// AI-generated suggestions (from AI_SUGGESTIONS_PATH) are merged into
// ONE `pulls.createReview` call so the PR conversation shows one
// review thread instead of two. main.ts skips its own postReview when
// `DRIFT_DEFER_INLINE_REVIEW=true`, handing the inline-review surface
// to this module.
//
// Inputs (env):
//   AI_SUGGESTIONS_PATH        — path to the model's response file (optional;
//                                 if missing/empty we post deterministic only)
//   DRIFT_REPORT_PATH          — path to the scanner's JSON report (used to
//                                 read deterministic code_suggestions); when
//                                 absent or unreadable we post AI-only
//   DRIFT_MAX_AI_SUGGESTIONS   — hard cap on AI entries (default 3)
//   DRIFT_AI_MODEL             — model id, used in the review body
//   DRIFT_DRY_RUN              — "true" → log payload, don't POST
//   GITHUB_TOKEN               — auth (required unless DRIFT_DRY_RUN)
//
// Failure policy: fail-soft. Any unrecoverable error logs a warning and
// exits 0; the sticky overview comment (posted by main.ts) is the
// authoritative outcome surface.

import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar, type CodeSuggestion, type ScanPrOutput } from './report.ts';
import { renderSuggestionBody, extractAfterCode } from './render/suggestion.ts';
import { parseAIOutput } from './ai/parse.ts';
import { fetchCommentableLines, fetchPrFiles, buildReviewComments } from './ai/post.ts';
import { filterByDiff, lookupCommentable, nearestCommentableLine } from './ai/diff-lines.ts';
import { mergeAiSuggestionsIntoReport } from './ai/to-code-suggestion.ts';
import { buildAndUpsertSticky } from './github/sticky-post.ts';
import type { ReviewComment } from './contract/github.ts';
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
  const maxAi = parseMax(process.env.DRIFT_MAX_AI_SUGGESTIONS, 3);
  // When set, main.ts deferred the sticky comment to THIS step so it can
  // include the AI-refined suggestions (which don't exist yet at step 9). We
  // then own the sticky post and must always reach it — even when there are no
  // inline comments to anchor.
  const deferSticky = process.env.DRIFT_DEFER_STICKY_COMMENT === 'true';

  // 1. Deterministic suggestions from the scan report. Optional — when the
  //    report path is missing/unreadable, we post AI-only (preserving the
  //    pre-combined behavior). The cap step in action.yml already trims
  //    code_suggestions to max-code-suggestions, so the worst-case here is
  //    bounded by that cap, not by the scanner. We keep the WHOLE report too —
  //    the deferred sticky render needs it.
  const report = loadReportSafe();
  const detSuggestions = (report?.pr_review?.code_suggestions ?? []).filter(passesQualityBar);

  // 2. AI suggestions from the envelope. Optional — when the envelope is
  //    missing/empty (AI loop failed, no models permission, …), we still
  //    post the deterministic review so the reviewer isn't left without
  //    inline comments. NO CAP yet — we cap AFTER the diff filter so the
  //    cap counts POSTABLE entries (legacy contract).
  const { suggestions: aiSuggestions, funnel: aiFunnel } = readAISuggestions();

  // Nothing to post AND we don't own the sticky → the original fast exit. When
  // we DO own the sticky we must continue so it ships (deterministic / empty).
  if (detSuggestions.length === 0 && aiSuggestions.length === 0 && !deferSticky) {
    core.info('No deterministic or AI suggestions to post — skipping combined review.');
    return;
  }

  const pr = resolvePrContext();
  if (!pr) {
    core.info('No PR context (pull_request payload or DRIFT_PR_* env vars) — skipping combined review.');
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token && !dryRun) {
    core.warning('No GITHUB_TOKEN — skipping combined review post.');
    return;
  }
  const octokit = getOctokit(token || 'dry-run-stub-token');
  const { owner, repo } = context.repo;

  // Anchor to the diff: drop suggestions whose lines GitHub would reject
  // (422). Pulls.createReview is ATOMIC — one off-diff anchor sinks the
  // ENTIRE review and every inline comment is lost. Best-effort: if the
  // diff fetch fails, proceed unfiltered and let the fail-soft POST handle
  // it. When we own the sticky we ALSO need the raw patches (to reconstruct
  // each AI suggestion's red/green diff), so one listFiles backs both.
  let commentable: Map<string, Set<number>> | null = null;
  let patches: Map<string, string> | null = null;
  try {
    if (deferSticky) {
      const f = await fetchPrFiles(octokit, owner, repo, pr.number);
      commentable = f.commentable;
      patches = f.patches;
    } else {
      commentable = await fetchCommentableLines(octokit, owner, repo, pr.number);
    }
  } catch (e) {
    core.warning(`Could not fetch PR diff to validate lines (${describe(e)}); posting unfiltered.`);
  }

  const detComments = buildDeterministicComments(detSuggestions, commentable);

  // AI: filter by diff FIRST, THEN cap. The cap counts POSTABLE entries
  // (the contract the legacy log line documents) so a high-cap user with
  // off-diff AI hallucinations doesn't have their cap silently eaten.
  const aiOnDiff = filterAIByDiff(aiSuggestions, commentable);
  const aiPostable = aiOnDiff.slice(0, maxAi);
  const aiComments = aiPostable.length > 0 ? buildReviewComments(aiPostable, model) : [];

  // Dedupe by `path:line`. When AI and deterministic anchors collide, the
  // AI one wins — it has the freshest, model-generated patch (the
  // deterministic suggestion is already mirrored in the sticky overview).
  const merged = mergeAndDedupe(detComments, aiComments);

  // AI funnel — the diagnostic readers rely on to spot dropped AI entries.
  // total → passing → on-diff → posted (cap applied at the end).
  if (aiFunnel.total > 0) {
    core.info(
      `🤖 ${model}: ${aiFunnel.total} candidate(s) → ${aiFunnel.passing} pass quality bar → ` +
        `${aiOnDiff.length} on-diff → ${aiPostable.length} posted (cap=${maxAi})`,
    );
  }
  core.info(
    `🟣 combined review: ${detComments.length} deterministic + ${aiComments.length} AI → ` +
      `${merged.length} comment(s) after dedupe`,
  );

  // Inline review — only when there's something to anchor. This is NOT a
  // function-level return anymore: the deferred sticky post below must still
  // run even when no inline comment lands on the diff.
  if (merged.length === 0) {
    if (aiFunnel.total > 0 && detComments.length === 0) {
      // Preserve the original "no AI landed on diff" message so the user
      // sees the right narrative when AI was the sole source.
      core.info('No AI suggestion landed on a diff line — nothing to post inline.');
    } else {
      core.info('No on-diff anchors — skipping inline review (suggestions still in the sticky comment).');
    }
  } else {
    await postCombinedReview({
      octokit,
      owner,
      repo,
      prNumber: pr.number,
      headSha: pr.headSha,
      comments: merged,
      detCount: detComments.length,
      aiCount: aiComments.length,
      model,
      dryRun,
    });
  }

  // Sticky comment — when deferred, render it HERE with the AI-refined
  // suggestions merged into the report so they surface in the "Code
  // suggestions" section as expanded "code suggestion" blocks (narrative +
  // red/green diff). Independent try/catch so a sticky failure never masks a
  // successful inline post, or vice-versa.
  if (deferSticky) {
    try {
      await postDeferredSticky({ octokit, owner, repo, report, pr, aiPostable, patches, model });
    } catch (e) {
      core.warning(`Deferred sticky comment failed (non-fatal): ${describe(e)}`);
    }
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

/**
 * Build review comments for deterministic suggestions, anchoring each to a
 * PR-diff line (when we know the commentable lines).
 *
 * The scanner anchors a finding at its SYMBOL's definition line (e.g. a dead
 * function), which lives in a changed file but is frequently NOT itself a line
 * in the PR's diff hunks — so a naive exact-line filter drops every such
 * finding and the inline review comes back empty (the failure this fixes).
 *
 * Policy, in order:
 *   1. File lookup is suffix-tolerant (`lookupCommentable`) — same as the AI
 *      path — so a monorepo / differently-rooted scanner path still resolves.
 *   2. Exact line is commentable → keep as-is.
 *   3. Exact line is OFF-diff but the finding is ADVISORY (no ```suggestion```
 *      Apply block) → SNAP to the nearest commentable line in the same file,
 *      and append a note pointing at the true location. The Apply button is
 *      what makes the anchor line-sensitive; advisory comments carry none, so
 *      moving them is safe and strictly better than zero inline coverage.
 *   4. Exact line is OFF-diff AND the finding carries an Apply block → DROP.
 *      Snapping would make GitHub's "Apply" rewrite the WRONG line. It stays
 *      in the sticky comment.
 *   5. File not in the diff at all → DROP (sticky-only).
 */
export function buildDeterministicComments(
  suggestions: CodeSuggestion[],
  commentable: Map<string, Set<number>> | null,
): ReviewComment[] {
  const anchored = suggestions
    .filter((s) => typeof s.line === 'number')
    .map((s) => ({
      suggestion: s,
      comment: {
        path: s.file,
        line: s.line as number,
        side: 'RIGHT' as const,
        body: renderSuggestionBody(s),
      } satisfies ReviewComment,
      // An Apply block makes the anchor line-sensitive — never snap those.
      hasApplyBlock: extractAfterCode(s) !== null,
    }));

  if (!commentable) return anchored.map((a) => a.comment);

  const kept: ReviewComment[] = [];
  let dropped = 0;
  let snapped = 0;
  for (const { comment, hasApplyBlock } of anchored) {
    const set = lookupCommentable(commentable, comment.path);
    if (!set || set.size === 0) {
      dropped += 1; // file not in the PR diff at all
      continue;
    }
    if (set.has(comment.line)) {
      kept.push(comment);
      continue;
    }
    if (hasApplyBlock) {
      dropped += 1; // can't move an Apply-button anchor without corrupting it
      continue;
    }
    const near = nearestCommentableLine(set, comment.line);
    if (near === undefined) {
      dropped += 1;
      continue;
    }
    kept.push({
      ...comment,
      line: near,
      body: withSnapNote(comment.body, comment.path, comment.line),
    });
    snapped += 1;
  }
  if (snapped > 0) {
    core.info(
      `Re-anchored ${snapped} deterministic suggestion(s) to the nearest PR-diff line ` +
        `(exact line was outside the diff hunks).`,
    );
  }
  if (dropped > 0) {
    core.info(
      `Dropped ${dropped} deterministic suggestion(s) not on a PR-diff line ` +
        `(still mirrored in the Drift sticky comment).`,
    );
  }
  return kept;
}

/** Append an honest "this anchor was moved" note so a reader is never misled
 *  about where the finding actually lives. Kept as a `>` blockquote so it
 *  reads as metadata below the suggestion body. */
function withSnapNote(body: string, path: string, originalLine: number): string {
  return `${body}\n\n> 📍 Anchored to the nearest changed line; the finding is at \`${path}:${originalLine}\`.`;
}

/** Merge deterministic + AI comments, deduping by `path:line`. AI wins on
 *  collision because it carries a freshly-generated patch. */
export function mergeAndDedupe(
  det: ReviewComment[],
  ai: ReviewComment[],
): ReviewComment[] {
  const key = (c: ReviewComment) => `${c.path}:${c.line}`;
  const aiKeys = new Set(ai.map(key));
  const detKept = det.filter((c) => !aiKeys.has(key(c)));
  // Order: deterministic first (severity-ranked by the scanner), AI after.
  // Inside each group the original order is preserved.
  return [...detKept, ...ai];
}

async function postCombinedReview(args: {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  comments: ReviewComment[];
  detCount: number;
  aiCount: number;
  model: string;
  dryRun: boolean;
}): Promise<void> {
  const { octokit, owner, repo, prNumber, headSha, comments, detCount, aiCount, model, dryRun } = args;
  const total = comments.length;
  // Body wording adapts to what we're posting:
  //   - AI only   → "🤖 openai/gpt-4.1 has N suggestion(s) to apply."
  //   - Det only  → "🟣 Drift has N suggestion(s) to apply."
  //   - Both      → "🟣 Drift has N + 🤖 openai/gpt-4.1 added M suggestion(s) to apply."
  // Keeping the AI-only and Det-only shapes byte-identical to the legacy
  // wording so consumers that grep the review body don't regress.
  let body: string;
  if (detCount > 0 && aiCount > 0) {
    body =
      `🟣 **Drift** has ${detCount} + 🤖 **${model}** added ${aiCount} ` +
      `suggestion${total === 1 ? '' : 's'} to apply.`;
  } else if (aiCount > 0) {
    body = `🤖 **${model}** has ${aiCount} suggestion${aiCount === 1 ? '' : 's'} to apply.`;
  } else {
    body = `🟣 **Drift** has ${detCount} suggestion${detCount === 1 ? '' : 's'} to apply.`;
  }

  const payload = {
    owner,
    repo,
    pull_number: prNumber,
    commit_id: headSha,
    event: 'COMMENT' as const,
    body,
    comments,
  };

  if (dryRun) {
    core.info(`[dry-run] Would POST pulls.createReview with ${total} comment(s).`);
    core.info(JSON.stringify(payload, null, 2));
    return;
  }

  try {
    await octokit.rest.pulls.createReview(payload);
    // Log line adapts so the user sees the right narrative. The legacy
    // ai-suggest tests assert "Posted AI review with N inline suggestion(s)";
    // a combined post says "combined PR review".
    let kind: string;
    if (detCount > 0 && aiCount > 0) kind = 'combined PR review';
    else if (aiCount > 0)            kind = 'AI review';
    else                             kind = 'PR review';
    core.info(`Posted ${kind} with ${total} inline suggestion(s).`);
  } catch (e) {
    // 422 on out-of-diff line numbers — known, benign; the sticky comment
    // already mirrors every deterministic suggestion.
    core.warning(`Combined review POST failed (non-fatal): ${describe(e)}`);
  }
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
