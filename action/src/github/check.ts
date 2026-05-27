import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { ScanPrOutput } from '../report.ts';
import { passesQualityBar, DRIFT_FAILS_PR } from '../report.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type CreateCheckArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  headSha: string;
  report: ScanPrOutput;
  /**
   * The SAME advisory gate the job uses (main.ts → core.setFailed): null =
   * never fail (Drift is advisory by default), a non-null N = fail only when
   * the product-correctness count EXCEEDS N. Threading it here keeps the
   * check run in lock-step with the job — so the check can't go red ✗ while
   * the job stays green.
   */
  failThreshold: number | null;
};

/**
 * Post a single Check Run titled "Drift / PR review" so the verdict
 * shows up in the PR's checks tab.
 *
 * NEVER FAILS FOR NOW: `DRIFT_FAILS_PR` is false, so the check can only be
 * 'neutral' (a finding) or 'success' (clean) — never a red ✗ — no matter the
 * findings or `fail-threshold`. When re-enabled, it concludes 'failure' only
 * when the consumer opted in via `fail-threshold` AND the product-correctness
 * count exceeds it (the exact predicate main.ts uses for core.setFailed).
 */
export async function createCheckRun(args: CreateCheckArgs): Promise<void> {
  const { octokit, owner, repo, headSha, report, failThreshold } = args;

  const suggestions = report.pr_review?.code_suggestions ?? [];
  const passing = suggestions.filter(passesQualityBar);
  const correctness = passing.filter((s) => s.category === 'B').length;

  // Advisory-only for now (DRIFT_FAILS_PR=false → never 'failure'). The
  // threshold terms stay so flipping the switch restores the opt-in.
  const shouldFail = DRIFT_FAILS_PR && failThreshold !== null && correctness > failThreshold;
  const conclusion: 'success' | 'neutral' | 'failure' =
    shouldFail ? 'failure' : passing.length > 0 ? 'neutral' : 'success';

  const title =
    correctness > 0
      ? `${correctness} product-correctness issue${correctness === 1 ? '' : 's'} found`
      : passing.length > 0
      ? `${passing.length} suggestion${passing.length === 1 ? '' : 's'} to apply`
      : 'OK — no high-confidence issues';

  await octokit.rest.checks.create({
    owner,
    repo,
    name: 'Drift / PR review',
    head_sha: headSha,
    status: 'completed',
    conclusion,
    output: {
      title,
      summary: pickSummary(report, passing.length, correctness),
    },
  });
  core.info(`Created check run for ${headSha.slice(0, 7)} (${conclusion})`);
}

function pickSummary(report: ScanPrOutput, passingCount: number, correctnessCount: number): string {
  const ps = report.pr_scope;
  return [
    `**${ps.affected_roots.length} affected entry point${ps.affected_roots.length === 1 ? '' : 's'}** · ${ps.changed_files.length} changed file${ps.changed_files.length === 1 ? '' : 's'} · ${ps.unreachable_changes.length} unreachable`,
    `${passingCount} suggestion${passingCount === 1 ? '' : 's'} cleared the quality bar (${correctnessCount} product-correctness)`,
  ].join('\n\n');
}
