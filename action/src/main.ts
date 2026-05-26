import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar, type ScanPrOutput } from './report.ts';
import { renderOverview } from './render/overview.ts';
import { upsertStickyComment } from './github/comment.ts';
import { postReview } from './github/review.ts';
import { createCheckRun } from './github/check.ts';

export async function main(): Promise<void> {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('No pull_request payload — Drift only runs on pull_request events. Skipping.');
    return;
  }

  const reportPath = process.env.DRIFT_REPORT_PATH;
  if (!reportPath) {
    throw new Error('DRIFT_REPORT_PATH is not set — the scan step must produce a JSON report.');
  }

  const failOn = (process.env.DRIFT_FAIL_ON ?? 'regression') as 'never' | 'regression' | 'any';
  const wantComment = (process.env.DRIFT_COMMENT ?? 'true') === 'true';
  const githubToken = process.env.GITHUB_TOKEN ?? '';

  core.info(`Loading Drift report from ${reportPath}`);
  const report = loadReport(reportPath);
  const suggestions = report.pr_review?.code_suggestions ?? [];
  const passing = suggestions.filter(passesQualityBar);

  core.setOutput('changed-files', String(report.pr_scope.changed_files.length));
  core.setOutput('affected-roots', String(report.pr_scope.affected_roots.length));
  core.setOutput('unreachable-changes', String(report.pr_scope.unreachable_changes.length));
  core.setOutput('suggestions-shown', String(passing.length));

  core.info(
    `Report ${report.schema_version}: ${report.pr_scope.changed_files.length} changed file(s), ` +
      `${report.pr_scope.affected_roots.length} affected root(s), ` +
      `${passing.length}/${suggestions.length} suggestions pass quality bar`,
  );

  if (!githubToken) {
    core.warning('No GITHUB_TOKEN provided — skipping check run + PR comment + review.');
    return;
  }

  const octokit = getOctokit(githubToken);
  const { owner, repo } = context.repo;
  const headSha: string = pr.head.sha;
  const prNumber: number = pr.number;

  const tasks: Promise<unknown>[] = [
    createCheckRun({ octokit, owner, repo, headSha, report }).catch((err) =>
      core.warning(`check run failed: ${describeError(err)}`),
    ),
    postReview({
      octokit,
      owner,
      repo,
      prNumber,
      headSha,
      suggestions,
    }).catch((err) => core.warning(`review failed: ${describeError(err)}`)),
  ];

  if (wantComment) {
    tasks.push(
      upsertStickyComment({
        octokit,
        owner,
        repo,
        prNumber,
        body: renderOverview(report),
      }).catch((err) => core.warning(`sticky comment failed: ${describeError(err)}`)),
    );
  }

  await Promise.all(tasks);

  if (shouldFail(report, failOn, passing.length)) {
    const correctness = passing.filter((s) => s.category === 'B').length;
    core.setFailed(
      `Drift found ${correctness} product-correctness issue(s) above threshold.`,
    );
  }
}

function shouldFail(
  report: ScanPrOutput,
  failOn: 'never' | 'regression' | 'any',
  passingCount: number,
): boolean {
  if (failOn === 'never') return false;
  const passing = (report.pr_review?.code_suggestions ?? []).filter(passesQualityBar);
  const correctness = passing.filter((s) => s.category === 'B').length;
  if (failOn === 'any') return passingCount > 0;
  return correctness > 0; // 'regression' = any product-correctness issue
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
