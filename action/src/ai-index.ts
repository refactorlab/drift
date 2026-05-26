// Entry point for the AI-suggestion post step.
//
// Reads the JSON produced by `actions/ai-inference@v1`, validates it
// against the AI envelope schema, applies the quality bar + the user-
// configured MAX cap, and posts the result as a single PR review via
// Octokit (so the call shape matches the rest of the action and is
// covered by our shape tests).
//
// Inputs (env):
//   AI_SUGGESTIONS_PATH        — path to the model's response file
//   DRIFT_MAX_AI_SUGGESTIONS   — hard cap (default 3)
//   DRIFT_AI_MODEL             — model id, used in the review body
//   DRIFT_DRY_RUN              — "true" → log payload, don't POST
//   GITHUB_TOKEN               — auth (required unless DRIFT_DRY_RUN)
//
// Failure policy: fail-soft. If anything goes wrong we log a warning
// and exit 0 — the deterministic scanner review (step 9) has already
// been posted.

import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { parseAIOutput } from './ai/parse.ts';
import { postAIReview } from './ai/post.ts';

async function aiMain(): Promise<void> {
  const aiPath = process.env.AI_SUGGESTIONS_PATH;
  if (!aiPath) {
    core.info('AI_SUGGESTIONS_PATH not set — skipping AI suggestion post.');
    return;
  }

  let raw: string;
  try {
    raw = readFileSync(aiPath, 'utf8');
  } catch (e) {
    core.warning(`AI suggestions file unreadable at ${aiPath}: ${describe(e)}`);
    return;
  }
  if (raw.trim().length === 0) {
    core.info('AI suggestions file is empty — skipping.');
    return;
  }

  const maxSuggestions = parseMax(process.env.DRIFT_MAX_AI_SUGGESTIONS, 3);
  const model = process.env.DRIFT_AI_MODEL || 'openai/gpt-5';
  const dryRun = process.env.DRIFT_DRY_RUN === 'true';

  const parsed = parseAIOutput(raw, { maxSuggestions });
  if (!parsed.ok) {
    core.warning(`AI output rejected: ${parsed.reason}`);
    core.info(`first 400 chars:\n${parsed.rawPreview}`);
    return;
  }

  core.info(
    `🤖 ${model}: ${parsed.total} candidate(s) → ${parsed.passing} pass quality bar → ${parsed.capped} posted (cap=${maxSuggestions})`,
  );

  if (parsed.suggestions.length === 0) {
    core.info('No AI suggestion cleared the quality bar — silence > noise.');
    return;
  }

  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('No pull_request in context — skipping AI review post.');
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token && !dryRun) {
    core.warning('No GITHUB_TOKEN — skipping AI review post.');
    return;
  }

  // For dry-run we still need *an* Octokit so types match. The token
  // is never used because postAIReview short-circuits on dryRun.
  const octokit = getOctokit(token || 'dry-run-stub-token');
  const { owner, repo } = context.repo;

  try {
    await postAIReview({
      octokit,
      owner,
      repo,
      prNumber: pr.number,
      headSha: pr.head.sha,
      suggestions: parsed.suggestions,
      model,
      dryRun,
    });
  } catch (e) {
    // 422 on out-of-diff line numbers is the common case here — log
    // and continue rather than failing the whole action.
    core.warning(`AI review POST failed (non-fatal): ${describe(e)}`);
  }
}

function parseMax(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

aiMain().catch((err) => {
  // Fail-soft at the top level.
  core.warning(`Unhandled AI-post error: ${describe(err)}`);
});
