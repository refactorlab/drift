import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar } from './report.ts';
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

  // Drift is ADVISORY by default: findings surface as warnings (in the PR
  // comment + as ::warning:: annotations) and never fail the consumer's
  // check. A consumer opts into failing by setting `fail-threshold` to a
  // number N — then the check fails when product-correctness issues exceed
  // N. Empty/unset/non-numeric → null → never fail (and never raises).
  const failThreshold = parseThreshold(process.env.DRIFT_FAIL_THRESHOLD);
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
        body: withAudioFooter(renderOverview(report)),
      }).catch((err) => core.warning(`sticky comment failed: ${describeError(err)}`)),
    );
  }

  await Promise.all(tasks);

  // Surface product-correctness findings as WARNINGS — they're rendered in
  // the sticky PR comment AND emitted as ::warning:: annotations here. They
  // never fail the check unless the consumer set a numeric `fail-threshold`
  // and the count EXCEEDS it (threshold 0 = fail on any).
  const correctness = passing.filter((s) => s.category === 'B').length;
  if (correctness > 0) {
    core.warning(
      `Drift flagged ${correctness} product-correctness issue(s) — ` +
        'see the Drift PR comment for details.',
    );
  }

  if (failThreshold !== null && correctness > failThreshold) {
    core.setFailed(
      `Drift found ${correctness} product-correctness issue(s), exceeding the configured ` +
        `fail-threshold of ${failThreshold}.`,
    );
  }
}

/**
 * Parse the optional `fail-threshold` env into a non-negative integer, or
 * null meaning "never fail". Empty/unset/blank → null. A non-numeric or
 * negative value → null + a warning (we NEVER throw on a bad threshold;
 * Drift stays advisory rather than breaking the PR on its own misconfig).
 */
function parseThreshold(raw: string | undefined): number | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    core.warning(
      `Ignoring invalid fail-threshold ${JSON.stringify(raw)} — expected a non-negative integer. ` +
        'Drift will not fail the PR.',
    );
    return null;
  }
  return n;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Append a "🔊 Listen" link to the sticky comment when the action's audio
 * step uploaded a synthesized WAV (DRIFT_AUDIO_URL = the artifact URL).
 * Empty/unset env (audio disabled or synthesis failed) → body unchanged, so
 * this is fully fail-soft and a no-op in the common case.
 */
export function withAudioFooter(body: string): string {
  const url = process.env.DRIFT_AUDIO_URL?.trim();
  if (!url) return body;
  return (
    `${body}\n\n---\n` +
    `🔊 **[Listen to this PR summary](${url})** — spoken business-logic summary ` +
    `(Piper TTS · downloadable WAV artifact).`
  );
}
