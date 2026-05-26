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
};

/**
 * Post or update the sticky overview comment.
 * We identify ours by the STICKY_MARKER hidden HTML comment at the top.
 */
export async function upsertStickyComment(args: UpsertStickyArgs): Promise<void> {
  const { octokit, owner, repo, prNumber, body } = args;

  const existing = await findStickyComment(octokit, owner, repo, prNumber);

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing,
      body,
    });
    core.info(`Updated sticky comment ${existing}`);
  } else {
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    core.info(`Created sticky comment ${data.id}`);
  }
}

async function findStickyComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number | null> {
  // PRs are paginated; 100 per page is the max and is enough in practice.
  // We only look at the first page to keep this cheap — sticky comments are
  // posted by us and stay near the top by recency.
  const { data } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const found = data.find((c) => c.body?.includes(STICKY_MARKER));
  return found?.id ?? null;
}
