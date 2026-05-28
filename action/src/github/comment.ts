import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import { STICKY_MARKER } from '../render/overview.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type UpsertStickyArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
  /**
   * The id of an already-located sticky comment (or null when we know there's
   * none). When provided, the lookup is skipped — main.ts fetches the prior
   * comment ONCE (to diff its embedded state) and passes the id back here.
   * `undefined` (the default) preserves the self-contained lookup behaviour.
   */
  existingId?: number | null;
};

/**
 * Post or update the sticky overview comment, identified by the STICKY_MARKER
 * hidden HTML comment at the top.
 */
export async function upsertStickyComment(args: UpsertStickyArgs): Promise<void> {
  const { octokit, owner, repo, prNumber, body } = args;
  const id = args.existingId !== undefined ? args.existingId : (await findSticky(octokit, owner, repo, prNumber))?.id ?? null;

  if (id) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: id, body });
    core.info(`Updated sticky comment ${id}`);
  } else {
    const { data } = await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    core.info(`Created sticky comment ${data.id}`);
  }
}

/**
 * Find our sticky comment and return its id AND body. main.ts reads the body to
 * recover the prior run's embedded drift snapshot (the "since last review"
 * diff). Returns null when there's no prior comment.
 */
export async function findSticky(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ id: number; body: string } | null> {
  // PRs are paginated; 100 per page is the max and is enough in practice — our
  // sticky comment stays near the top by recency.
  const { data } = await octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 });
  const found = data.find((c) => c.body?.includes(STICKY_MARKER));
  return found ? { id: found.id, body: found.body ?? '' } : null;
}
