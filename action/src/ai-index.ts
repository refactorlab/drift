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
import { loadReport, passesQualityBar, type CodeSuggestion } from './report.ts';
import { renderSuggestionBody } from './render/suggestion.ts';
import { parseAIOutput } from './ai/parse.ts';
import { fetchCommentableLines, buildReviewComments } from './ai/post.ts';
import { filterByDiff } from './ai/diff-lines.ts';
import type { ReviewComment } from './contract/github.ts';
import type { AISuggestion } from './ai/schema.ts';
import { resolvePrContext } from './pr-context.ts';

type Octokit = ReturnType<typeof getOctokit>;

type AIFunnel = {
  total: number;       // raw entries the model emitted
  passing: number;     // cleared the AI quality bar (parseAIOutput)
};

async function aiMain(): Promise<void> {
  const model = process.env.DRIFT_AI_MODEL || 'openai/gpt-4o';
  const dryRun = process.env.DRIFT_DRY_RUN === 'true';
  const maxAi = parseMax(process.env.DRIFT_MAX_AI_SUGGESTIONS, 3);

  // 1. Deterministic suggestions from the scan report. Optional — when the
  //    report path is missing/unreadable, we post AI-only (preserving the
  //    pre-combined behavior). The cap step in action.yml already trims
  //    code_suggestions to max-code-suggestions, so the worst-case here is
  //    bounded by that cap, not by the scanner.
  const detSuggestions = readDeterministicSuggestions();

  // 2. AI suggestions from the envelope. Optional — when the envelope is
  //    missing/empty (AI loop failed, no models permission, …), we still
  //    post the deterministic review so the reviewer isn't left without
  //    inline comments. NO CAP yet — we cap AFTER the diff filter so the
  //    cap counts POSTABLE entries (legacy contract).
  const { suggestions: aiSuggestions, funnel: aiFunnel } = readAISuggestions();

  if (detSuggestions.length === 0 && aiSuggestions.length === 0) {
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
  // it.
  let commentable: Map<string, Set<number>> | null = null;
  try {
    commentable = await fetchCommentableLines(octokit, owner, repo, pr.number);
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

  if (merged.length === 0) {
    if (aiFunnel.total > 0 && detComments.length === 0) {
      // Preserve the original "no AI landed on diff" message so the user
      // sees the right narrative when AI was the sole source.
      core.info('No AI suggestion landed on a diff line — nothing to post.');
    } else {
      core.info('No on-diff anchors — skipping combined review (suggestions still in the sticky comment).');
    }
    return;
  }

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

/** Read code_suggestions from DRIFT_REPORT_PATH; apply the deterministic
 *  quality bar (confidence ≥ 0.75, reference present, category A/B/C). */
function readDeterministicSuggestions(): CodeSuggestion[] {
  const path = process.env.DRIFT_REPORT_PATH;
  if (!path) return [];
  let report: ReturnType<typeof loadReport>;
  try {
    report = loadReport(path);
  } catch (e) {
    core.info(`Drift report unreadable at ${path}: ${describe(e)} — combined review will skip deterministic`);
    return [];
  }
  const suggestions = report.pr_review?.code_suggestions ?? [];
  return suggestions.filter(passesQualityBar);
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
    core.info(`AI envelope unreadable at ${path}: ${describe(e)} — combined review will skip AI`);
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

/** Build review comments for deterministic suggestions, dropping anchors
 *  that aren't on the PR diff (when we know the commentable lines). */
function buildDeterministicComments(
  suggestions: CodeSuggestion[],
  commentable: Map<string, Set<number>> | null,
): ReviewComment[] {
  const comments = suggestions
    .filter((s) => typeof s.line === 'number')
    .map<ReviewComment>((s) => ({
      path: s.file,
      line: s.line as number,
      side: 'RIGHT',
      body: renderSuggestionBody(s),
    }));
  if (!commentable) return comments;
  const before = comments.length;
  const kept = comments.filter(
    (c) => typeof c.line === 'number' && (commentable.get(c.path)?.has(c.line) ?? false),
  );
  const dropped = before - kept.length;
  if (dropped > 0) {
    core.info(
      `Dropped ${dropped} deterministic suggestion(s) not on a PR-diff line ` +
        `(still mirrored in the Drift sticky comment).`,
    );
  }
  return kept;
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

aiMain().catch((err) => {
  // Fail-soft at the top level.
  core.warning(`Unhandled combined-review error: ${describe(err)}`);
});
