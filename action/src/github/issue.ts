import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';

type Octokit = ReturnType<typeof getOctokit>;

// GitHub caps issue titles at 256 chars.
const TITLE_CAP = 256;

/**
 * Per-PR dedup marker. One tracking issue per PR: re-running `/drift issue`
 * updates the same issue instead of opening a new one each time.
 */
export function issueMarker(prNumber: number): string {
  return `<!-- drift:tracking-issue:pr-${prNumber} -->`;
}

export type UpsertIssueArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  title: string;
  body: string;
  /**
   * A pre-located issue number (or null when we know there's none) to skip the
   * lookup. `undefined` (default) keeps the self-contained find-then-write.
   */
  existingNumber?: number | null;
};

/**
 * Create or update the single Drift tracking issue for a PR, deduplicated by
 * the hidden marker in its body. Returns the issue number.
 */
export async function upsertTrackingIssue(args: UpsertIssueArgs): Promise<number> {
  const { octokit, owner, repo, prNumber, body } = args;
  const title = args.title.slice(0, TITLE_CAP);
  const number =
    args.existingNumber !== undefined
      ? args.existingNumber
      : (await findTrackingIssue(octokit, owner, repo, prNumber))?.number ?? null;

  if (number) {
    await octokit.rest.issues.update({ owner, repo, issue_number: number, title, body });
    core.info(`Updated Drift tracking issue #${number}`);
    return number;
  }
  const { data } = await octokit.rest.issues.create({ owner, repo, title, body });
  core.info(`Created Drift tracking issue #${data.number}`);
  return data.number;
}

/**
 * Find this PR's open tracking issue by its hidden marker. listForRepo returns
 * pull requests too (a PR IS an issue in the REST API) — we drop those so a PR
 * can never be mistaken for the tracking issue.
 */
export async function findTrackingIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ number: number; body: string } | null> {
  const marker = issueMarker(prNumber);
  // 100/page (the max) is enough in practice — the tracking issue is recent and
  // listForRepo returns newest-first by default.
  const { data } = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 100 });
  const found = data.find((i) => !i.pull_request && i.body?.includes(marker));
  return found ? { number: found.number, body: found.body ?? '' } : null;
}
