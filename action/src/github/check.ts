import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { ScanPrOutput } from '../report.ts';
import { passesQualityBar } from '../report.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type CreateCheckArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  headSha: string;
  report: ScanPrOutput;
};

/**
 * Post a single Check Run titled "Drift / PR review" so the verdict
 * shows up in the PR's checks tab. Without runtime telemetry we can't
 * compute a "regression" verdict — the conclusion derives from whether
 * any high-confidence correctness suggestion fired.
 */
export async function createCheckRun(args: CreateCheckArgs): Promise<void> {
  const { octokit, owner, repo, headSha, report } = args;

  const suggestions = report.pr_review?.code_suggestions ?? [];
  const passing = suggestions.filter(passesQualityBar);
  const correctness = passing.filter((s) => s.category === 'B').length;

  const conclusion: 'success' | 'neutral' | 'failure' =
    correctness > 0 ? 'failure' : passing.length > 0 ? 'neutral' : 'success';

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
