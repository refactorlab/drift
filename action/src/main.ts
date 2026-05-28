import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar, DRIFT_FAILS_PR } from './report.ts';
import { renderOverview } from './render/overview.ts';
import { upsertStickyComment, findSticky } from './github/comment.ts';
import { postReview } from './github/review.ts';
import { createCheckRun } from './github/check.ts';
import { parseState, type DriftState } from './render/state.ts';
import type { PrContext } from './render/context.ts';
import { resolvePrContext } from './pr-context.ts';

export async function main(): Promise<void> {
  const pr = resolvePrContext();
  if (!pr) {
    core.info('No PR context (pull_request payload or DRIFT_PR_* env vars) — Drift skipping.');
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
  const headSha: string = pr.headSha;
  const prNumber: number = pr.number;

  // GitHub-side facts the scan JSON doesn't carry — used for the title line and
  // to turn file:line references into SHA-pinned permalinks.
  const prCtx: PrContext = {
    owner,
    repo,
    sha: headSha,
    prNumber,
    prTitle: pr.title,
    htmlUrl: pr.htmlUrl,
    baseRef: pr.baseRef,
    author: pr.author,
  };
  const audioUrl = process.env.DRIFT_AUDIO_URL?.trim() || undefined;

  const tasks: Promise<unknown>[] = [
    createCheckRun({ octokit, owner, repo, headSha, report, failThreshold }).catch((err) =>
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
    // Read the prior sticky comment ONCE: we recover its embedded drift
    // snapshot for the "since last review" delta, and reuse its id so the
    // upsert doesn't list comments a second time. Best-effort — any failure
    // just means a first-run delta line.
    let priorState: DriftState | null = null;
    let existingId: number | null = null;
    try {
      const prior = await findSticky(octokit, owner, repo, prNumber);
      existingId = prior?.id ?? null;
      priorState = parseState(prior?.body);
    } catch (err) {
      core.warning(`could not read prior sticky comment: ${describeError(err)}`);
    }

    const body = renderOverview(report, { ctx: prCtx, priorState, audioUrl });
    tasks.push(
      upsertStickyComment({ octokit, owner, repo, prNumber, body, existingId }).catch((err) =>
        core.warning(`sticky comment failed: ${describeError(err)}`),
      ),
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

  // NEVER FAILS FOR NOW: DRIFT_FAILS_PR is false, so the job stays green
  // regardless of findings / fail-threshold. Flip DRIFT_FAILS_PR (report.ts)
  // to re-enable the opt-in. The threshold terms stay live for that flip.
  if (DRIFT_FAILS_PR && failThreshold !== null && correctness > failThreshold) {
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
