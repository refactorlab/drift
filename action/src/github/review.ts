import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { CodeSuggestion } from '../report.ts';
import { passesQualityBar } from '../report.ts';
import { renderSuggestionBody } from '../render/suggestion.ts';
import { fetchCommentableLines } from '../ai/post.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type PostReviewArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  suggestions: CodeSuggestion[];
};

/**
 * Post a single PR review carrying every quality-passing suggestion as an
 * inline comment. Review comments — unlike issue comments — render the
 * `suggestion` block with an "Apply suggestion" button.
 *
 * Spec rule: if no suggestion clears the bar, post no review at all.
 */
export async function postReview(args: PostReviewArgs): Promise<void> {
  const { octokit, owner, repo, prNumber, headSha, suggestions } = args;

  const passing = suggestions.filter(passesQualityBar);
  if (passing.length === 0) {
    core.info('No suggestions cleared the quality bar; skipping review.');
    return;
  }

  let comments = passing
    .filter((s) => typeof s.line === 'number')
    .map((s) => ({
      path: s.file,
      line: s.line as number,
      side: 'RIGHT' as const,
      body: renderSuggestionBody(s),
    }));

  if (comments.length === 0) {
    core.info('Suggestions present but none have a line anchor; skipping review.');
    return;
  }

  // Pre-filter to lines GitHub will actually accept. createReview is ATOMIC:
  // ONE comment anchored outside the PR diff 422s the WHOLE review and drops
  // every inline suggestion. The AI post path already filters this way
  // (ai/post.ts → filterByDiff); the deterministic path must too, or a single
  // off-diff anchor sinks all the good ones. Best-effort: if the diff fetch
  // fails, fall through and let the atomic-422 catch below handle it.
  try {
    const commentable = await fetchCommentableLines(octokit, owner, repo, prNumber);
    const before = comments.length;
    comments = comments.filter((c) => commentable.get(c.path)?.has(c.line) ?? false);
    const dropped = before - comments.length;
    if (dropped > 0) {
      core.info(
        `Dropped ${dropped} inline suggestion(s) not on a PR-diff line; ` +
          `${comments.length} anchor on-diff (all are still mirrored in the Drift PR comment).`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    core.info(`Could not fetch PR diff to pre-filter anchors (${msg}); posting unfiltered.`);
  }

  if (comments.length === 0) {
    core.info('No suggestion anchors on a PR-diff line; skipping inline review (all shown in the Drift comment).');
    return;
  }

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event: 'COMMENT',
      body: `🟣 **Drift** has ${comments.length} suggestion${comments.length === 1 ? '' : 's'} to apply.`,
      comments,
    });
    core.info(`Posted PR review with ${comments.length} inline suggestion(s).`);
  } catch (err) {
    // createReview is ATOMIC: a single comment whose path/line is outside
    // the PR diff makes GitHub reject the WHOLE review with 422 "Path could
    // not be resolved". That's not a failure worth a scary warning — the
    // sticky comment already mirrors every suggestion (render/sections/
    // suggestions.ts), so the author still sees them. Downgrade to info and
    // move on; rethrow anything that isn't that known, benign 422.
    if (isUnresolvedPathError(err)) {
      core.info(
        `Inline review skipped: ${comments.length} suggestion(s) anchor to lines outside the ` +
          'PR diff (GitHub 422 "Path could not be resolved"). They are shown in the Drift PR comment instead.',
      );
      return;
    }
    throw err;
  }
}

/** A GitHub 422 caused by an inline comment anchored outside the PR diff. */
function isUnresolvedPathError(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | null;
  const status = e?.status;
  const message = typeof e?.message === 'string' ? e.message : '';
  return status === 422 || /could not be resolved|Unprocessable/i.test(message);
}
