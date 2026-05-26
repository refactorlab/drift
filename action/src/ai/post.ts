// Post AI-generated inline suggestions as a GitHub PR review.
//
// Validated against the documented schema (May 2026):
//   POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
//   https://docs.github.com/en/rest/pulls/reviews?apiVersion=2022-11-28
//
// Multi-line suggestions: when a suggestion carries `start_line`,
// we emit `start_line` + `start_side` so GitHub renders the
// "Apply suggestion" button on a range.

import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { AISuggestion } from './schema.ts';
import { renderAISuggestionBody } from './render.ts';
import { parseCommentableLines } from './diff-lines.ts';
import type { ReviewComment } from '../contract/github.ts';

type Octokit = ReturnType<typeof getOctokit>;

/**
 * Read the PR's diff and return a map of file → commentable RIGHT-side
 * line numbers. This is the authoritative source GitHub itself uses to
 * accept/reject inline comments, so filtering against it prevents the
 * 422 "line must be part of the diff" that would drop the whole review.
 *
 * Single page of 100 files (same pattern as the sticky-comment lookup);
 * files beyond that — or binary/large files with no `.patch` — simply
 * contribute no commentable lines, so their suggestions get dropped.
 */
export async function fetchCommentableLines(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Map<string, Set<number>>> {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  const map = new Map<string, Set<number>>();
  for (const f of data) {
    if (f.patch) map.set(f.filename, parseCommentableLines(f.patch));
  }
  return map;
}

export type PostAIReviewArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  suggestions: AISuggestion[];
  model: string;
  dryRun?: boolean;
};

export type PostAIReviewResult = {
  posted: boolean;
  commentCount: number;
  payload: {
    owner: string;
    repo: string;
    pull_number: number;
    commit_id: string;
    event: 'COMMENT';
    body: string;
    comments: ReviewComment[];
  };
};

/**
 * Build the `comments[]` array for pulls.createReview. Exported for
 * tests so we can assert payload shape without spying on octokit.
 */
export function buildReviewComments(
  suggestions: AISuggestion[],
  model: string,
): ReviewComment[] {
  return suggestions.map((s) => {
    const body = renderAISuggestionBody(s, model);
    const comment: ReviewComment = {
      path: s.file,
      line: s.line,
      side: 'RIGHT',
      body,
    };
    if (typeof s.start_line === 'number' && s.start_line < s.line) {
      comment.start_line = s.start_line;
      comment.start_side = 'RIGHT';
    }
    return comment;
  });
}

export async function postAIReview(args: PostAIReviewArgs): Promise<PostAIReviewResult> {
  const { octokit, owner, repo, prNumber, headSha, suggestions, model, dryRun } = args;

  const comments = buildReviewComments(suggestions, model);

  const payload = {
    owner,
    repo,
    pull_number: prNumber,
    commit_id: headSha,
    event: 'COMMENT' as const,
    body: `🤖 **${model}** has ${comments.length} suggestion${comments.length === 1 ? '' : 's'} to apply.`,
    comments,
  };

  if (comments.length === 0) {
    core.info('No AI suggestions to post — skipping review.');
    return { posted: false, commentCount: 0, payload };
  }

  if (dryRun) {
    core.info(`[dry-run] Would POST pulls.createReview with ${comments.length} comment(s).`);
    core.info(JSON.stringify(payload, null, 2));
    return { posted: false, commentCount: comments.length, payload };
  }

  await octokit.rest.pulls.createReview(payload);
  core.info(`Posted AI review with ${comments.length} inline suggestion(s).`);
  return { posted: true, commentCount: comments.length, payload };
}
