import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { loadReport, passesQualityBar, DRIFT_FAILS_PR } from './report.ts';
import { renderOverview } from './render/overview.ts';
import { buildAndUpsertSticky } from './github/sticky-post.ts';
import { upsertTrackingIssue, issueMarker } from './github/issue.ts';
import { postReview } from './github/review.ts';
import { createCheckRun } from './github/check.ts';
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
  // Opt-in: open/update one deduplicated tracking issue for this PR's findings.
  // Driven by the `/drift issue` comment command (or open-issue: true). Needs
  // the consumer to grant `issues: write` — otherwise the call 403s and is
  // swallowed below, leaving the rest of the review intact.
  const wantIssue = (process.env.DRIFT_OPEN_ISSUE ?? 'false') === 'true';
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
  // Artifact URLs of the machine-readable scan outputs, surfaced in a
  // collapsed accordion at the bottom of the comment: the raw scanner report
  // (pr-scan.json) and the scan-context bundle (pr-scan-context.json). Both
  // are empty when the artifact upload is disabled or upload-artifact@v7
  // returned no URL → the accordion drops the missing link (fail-soft).
  const scanJsonUrl = process.env.DRIFT_SCAN_JSON_URL?.trim() || undefined;
  const scanContextUrl = process.env.DRIFT_SCAN_CONTEXT_URL?.trim() || undefined;

  // When AI suggestions are enabled, the AI-post step (dist/ai-suggest.js)
  // posts a SINGLE combined PR review — deterministic + AI — so reviewers see
  // ONE review thread in the PR conversation, not two. Setting
  // `DRIFT_DEFER_INLINE_REVIEW=true` here tells main.ts to skip its own
  // postReview so the combined poster owns the surface. When AI is disabled
  // the flag stays empty and main.ts posts the deterministic review as before.
  const deferInlineReview = process.env.DRIFT_DEFER_INLINE_REVIEW === 'true';

  // When AI suggestions are enabled, the sticky comment is ALSO deferred to the
  // AI-post step (dist/ai-suggest.js) — it merges the AI-refined suggestions
  // (which don't exist yet at this step) into the report and renders the sticky
  // with them included. main.ts still does the check run, tracking issue, and
  // ::warning:: annotations; only the sticky-comment post moves. When AI is off
  // this stays empty and main.ts posts the sticky here as before.
  const deferSticky = process.env.DRIFT_DEFER_STICKY_COMMENT === 'true';

  const tasks: Promise<unknown>[] = [
    createCheckRun({ octokit, owner, repo, headSha, report, failThreshold }).catch((err) =>
      core.warning(`check run failed: ${describeError(err)}`),
    ),
  ];
  if (deferInlineReview) {
    core.info(
      'DRIFT_DEFER_INLINE_REVIEW=true — skipping deterministic inline review; ' +
        'the AI-post step will publish a single combined review (deterministic + AI).',
    );
  } else {
    tasks.push(
      postReview({
        octokit,
        owner,
        repo,
        prNumber,
        headSha,
        suggestions,
      }).catch((err) => core.warning(`review failed: ${describeError(err)}`)),
    );
  }

  if (wantComment && deferSticky) {
    core.info(
      'DRIFT_DEFER_STICKY_COMMENT=true — skipping the sticky comment here; ' +
        'the AI-post step will render it with the AI-refined suggestions merged in.',
    );
  } else if (wantComment) {
    // Render + upsert the sticky overview. The shared helper reads the prior
    // sticky once (for the "since last review" delta) and reuses its id — the
    // SAME path ai-index.ts takes when the post is deferred, so the two can't
    // drift.
    tasks.push(
      buildAndUpsertSticky({
        octokit,
        owner,
        repo,
        prNumber,
        report,
        ctx: prCtx,
        audioUrl,
        scanJsonUrl,
        scanContextUrl,
      }).catch((err) => core.warning(`sticky comment failed: ${describeError(err)}`)),
    );
  }

  if (wantIssue) {
    // Same rendered overview as the sticky comment, prefixed with the per-PR
    // dedup marker and a backlink so the issue stands on its own. Reuses the
    // tested renderer rather than maintaining a second issue-only layout.
    const prLink = prCtx.htmlUrl ? `[#${prNumber}](${prCtx.htmlUrl})` : `#${prNumber}`;
    const issueBody =
      `${issueMarker(prNumber)}\n\n> Drift tracking issue for ${prLink}` +
      ` — refreshed each time \`/drift issue\` runs.\n\n` +
      renderOverview(report, { ctx: prCtx, audioUrl, scanJsonUrl, scanContextUrl });
    const issueTitle = `Drift findings — PR #${prNumber}${prCtx.prTitle ? `: ${prCtx.prTitle}` : ''}`;
    tasks.push(
      upsertTrackingIssue({ octokit, owner, repo, prNumber, title: issueTitle, body: issueBody }).catch((err) =>
        core.warning(`tracking issue failed: ${describeError(err)}`),
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
