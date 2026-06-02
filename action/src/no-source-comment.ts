// Entry: post the "no code to analyze" sticky comment for a docs/config-only PR.
//
// The action runs this (dist/no-source.js) ONLY when the diff step resolved a
// head SHA but `has_source=false` — i.e. the PR touched no file in a language
// the scanner understands, so the scan + full comment were skipped. Rather than
// leave the PR silent (which reads as "Drift is broken"), we upsert ONE honest
// sticky comment to the SAME surface the full report uses (STICKY_MARKER), so:
//   • a fresh docs-only PR gets a clear "nothing to analyze" note, and
//   • a PR that previously had code (full report posted) and then dropped it to
//     docs-only gets that report REPLACED in place — no stale verdict lingers.
//
// Fail-soft, exactly like index.ts: Drift is advisory and must NEVER fail a
// consumer's PR on its own error. Any throw is downgraded to a ::warning::.
//
// Env (all set by action.yml's derivation + diff steps):
//   GITHUB_TOKEN, GITHUB_REPOSITORY
//   DRIFT_PR_NUMBER, DRIFT_HEAD_SHA, DRIFT_HEAD_REF, DRIFT_BASE_REF,
//   DRIFT_PR_TITLE, DRIFT_PR_HTML_URL, DRIFT_PR_AUTHOR
//   DRIFT_CHANGED_PATH        — file listing the PR's changed paths (one per line)
//   DRIFT_AUDIO_URL           — optional WAV artifact URL → 🔊 banner + footer link

import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { resolvePrContext } from './pr-context.ts';
import type { PrContext } from './render/context.ts';
import { renderNoSource } from './render/no_source.ts';
import { findSticky, upsertStickyComment } from './github/comment.ts';

async function run(): Promise<void> {
  const pr = resolvePrContext();
  if (!pr) {
    core.info('No PR context (DRIFT_PR_* env vars) — nothing to post.');
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) {
    core.warning('No GITHUB_TOKEN — skipping the no-source notice comment.');
    return;
  }

  const octokit = getOctokit(githubToken);
  const { owner, repo } = context.repo;

  const prCtx: PrContext = {
    owner,
    repo,
    sha: pr.headSha,
    prNumber: pr.number,
    prTitle: pr.title,
    htmlUrl: pr.htmlUrl,
    baseRef: pr.baseRef,
    author: pr.author,
  };

  const changedFiles = readChangedFiles(process.env.DRIFT_CHANGED_PATH);
  // A docs/config-only PR now also gets a commit-based spoken summary (the
  // audio pipeline gates fire on has_source=false), so the notice carries the
  // 🔊 link when the upload resolved. Empty → renderer omits it (fail-soft).
  const audioUrl = process.env.DRIFT_AUDIO_URL?.trim() || undefined;

  const body = renderNoSource({ ctx: prCtx, changedFiles, audioUrl });

  // Reuse the prior sticky's id so we UPDATE in place (replacing any stale full
  // report) instead of stacking a second comment.
  let existingId: number | null = null;
  try {
    existingId = (await findSticky(octokit, owner, repo, pr.number))?.id ?? null;
  } catch (err) {
    core.warning(`could not read prior sticky comment: ${describe(err)}`);
  }

  await upsertStickyComment({ octokit, owner, repo, prNumber: pr.number, body, existingId });
  core.info(`Posted no-source notice (${changedFiles.length} changed file(s), ${body.length} bytes).`);
}

/** Read the newline-delimited changed-files listing the diff step wrote. */
function readChangedFiles(path: string | undefined): string[] {
  if (!path) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch (err) {
    core.warning(`could not read changed-files list (${path}): ${describe(err)}`);
    return [];
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

run().catch((err) => {
  core.warning(
    `Drift could not post the no-source notice: ${describe(err)}. This does not fail the PR.`,
  );
});
