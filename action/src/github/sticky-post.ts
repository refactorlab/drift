// Build + upsert the sticky overview comment — the single source of truth for
// "render the report and post/refresh the sticky comment", shared by the two
// callers that need it:
//
//   • main.ts (step 9) — the normal path, when AI suggestions are OFF.
//   • ai-index.ts (step 12) — when AI suggestions are ON, the sticky post is
//     DEFERRED here so the comment can include the AI-refined suggestions that
//     don't exist yet at step 9. ai-index merges them into the report first.
//
// Centralising the find-prior → diff-state → render → upsert sequence keeps the
// "since last review" delta logic identical on both paths: each reads the TRUE
// prior sticky (the previous push's comment) before posting this run's.

import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { ScanPrOutput } from '../report.ts';
import type { PrContext } from '../render/context.ts';
import { renderOverview } from '../render/overview.ts';
import { parseState } from '../render/state.ts';
import { findSticky, upsertStickyComment } from './comment.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type StickyPostArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  report: ScanPrOutput;
  ctx: PrContext;
  /** Footer/section inputs threaded through to renderOverview (all optional). */
  audioUrl?: string;
  scanJsonUrl?: string;
  scanContextUrl?: string;
  maxSuggestions?: number;
  /** When true, render + log the would-be body but skip the upsert POST. */
  dryRun?: boolean;
};

/**
 * Render the overview for `report` and upsert it as the sticky comment.
 * Reads the prior sticky ONCE to recover its embedded snapshot (for the
 * "since last review" delta) and reuse its id. Best-effort on the prior read —
 * a failure just yields a first-run delta line, never a thrown error.
 */
export async function buildAndUpsertSticky(args: StickyPostArgs): Promise<void> {
  const { octokit, owner, repo, prNumber, report, ctx } = args;

  let priorState = null;
  let existingId: number | null = null;
  try {
    const prior = await findSticky(octokit, owner, repo, prNumber);
    existingId = prior?.id ?? null;
    priorState = parseState(prior?.body);
  } catch (err) {
    core.warning(`could not read prior sticky comment: ${describe(err)}`);
  }

  const body = renderOverview(report, {
    ctx,
    priorState,
    audioUrl: args.audioUrl,
    scanJsonUrl: args.scanJsonUrl,
    scanContextUrl: args.scanContextUrl,
    maxSuggestions: args.maxSuggestions,
  });

  if (args.dryRun) {
    core.info(
      `[dry-run] would upsert sticky comment (${body.length} bytes)` +
        `${existingId ? ` to comment ${existingId}` : ' (new)'}.`,
    );
    return;
  }

  await upsertStickyComment({ octokit, owner, repo, prNumber, body, existingId });
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
