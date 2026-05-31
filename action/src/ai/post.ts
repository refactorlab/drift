// PR-diff lookups for the AI suggestion path.
//
// AI suggestions are NOT posted as a second inline review — they render in the
// single Drift sticky comment (see ai-index.ts → render/sections/suggestions.ts),
// as a markdown red/green diff. These helpers only read the PR diff: the
// commentable-line map (so a suggestion that anchors off-diff is dropped before
// it can mis-anchor) and the raw per-file `.patch` (so the sticky comment's
// red/green diff is reconstructed from the authoritative GitHub patch — see
// ai/to-code-suggestion.ts).

import type { getOctokit } from '@actions/github';
import { parseCommentableLines } from './diff-lines.ts';

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

/**
 * One pulls.listFiles pass that returns BOTH the commentable-lines map (for
 * the diff filter) AND the raw per-file `.patch` text (for reconstructing the
 * red/green diff of an AI suggestion — see ai/to-code-suggestion.ts). Used by
 * the sticky-comment poster; a single call backs both needs.
 */
export async function fetchPrFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ commentable: Map<string, Set<number>>; patches: Map<string, string> }> {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  const commentable = new Map<string, Set<number>>();
  const patches = new Map<string, string>();
  for (const f of data) {
    if (f.patch) {
      commentable.set(f.filename, parseCommentableLines(f.patch));
      patches.set(f.filename, f.patch);
    }
  }
  return { commentable, patches };
}
