// Entry point for the AI-context build step.
//
// Reads env, calls buildAIContext, writes the result to AI_CONTEXT_PATH.
// Exits 0 on any failure (the AI step itself is opt-in / non-fatal).
//
// Env:
//   DRIFT_REPORT_PATH        — scanner output JSON
//   AI_CONTEXT_PATH          — file to write the bundled context to
//   GITHUB_WORKSPACE         — checkout root (where source files live)
//   AI_BASE_SHA / AI_HEAD_SHA — diff range
//   AI_MAX_FILES             — diff file cap (default 20)
//   AI_MAX_FOCAL_POINTS      — focal-point cap (default 5)
//   AI_BYTE_BUDGET           — overall byte cap (default 80000)

import { writeFileSync } from 'node:fs';
import * as core from '@actions/core';
import { buildAIContext } from './ai/build-context.ts';

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function aiContextMain(): Promise<void> {
  const reportPath = process.env.DRIFT_REPORT_PATH ?? '';
  const outPath = process.env.AI_CONTEXT_PATH ?? '';
  const workspaceRoot = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const baseSha = process.env.AI_BASE_SHA ?? '';
  const headSha = process.env.AI_HEAD_SHA ?? '';

  if (!outPath) {
    core.warning('AI_CONTEXT_PATH not set — cannot write AI context.');
    return;
  }
  if (!baseSha || !headSha) {
    core.warning('AI_BASE_SHA / AI_HEAD_SHA missing — writing empty context.');
    writeFileSync(outPath, '');
    return;
  }

  const result = buildAIContext({
    reportPath,
    workspaceRoot,
    baseSha,
    headSha,
    maxFiles: intEnv('AI_MAX_FILES', 20),
    maxFocalPoints: intEnv('AI_MAX_FOCAL_POINTS', 5),
    byteBudget: intEnv('AI_BYTE_BUDGET', 80_000),
  });

  writeFileSync(outPath, result.text);
  core.info(
    `📝 AI context: ${result.bytes} bytes, ` +
      `${result.focalPoints} focal point(s), ` +
      `${result.diffFiles} diff file(s), ` +
      `source=${result.source} → ${outPath}`,
  );
  // Diagnostics — make an empty/fallback context debuggable from the logs.
  core.info(
    `   diagnostics: reportLoaded=${result.reportLoaded}, ` +
      `code_suggestions_in_report=${result.codeSuggestionsInReport}, ` +
      `diff_strategy=${result.diffStrategy}`,
  );
  if (result.reportLoaded && result.codeSuggestionsInReport === 0) {
    core.info(
      '   note: scanner report loaded but emitted 0 code_suggestions — ' +
        'AI ran in diff-fallback mode (no focal points to enrich).',
    );
  }
  if (!result.reportLoaded) {
    core.warning(
      `   scanner report not found/parseable at ${reportPath} — AI context is diff-only.`,
    );
  }
  if (result.diffStrategy === 'none') {
    core.warning(
      '   git diff produced no hunks (shallow clone with no shared history?) — ' +
        'GPT-5 has no diff lines to anchor suggestions to.',
    );
  }
}

aiContextMain().catch((err) => {
  core.warning(
    `AI context build failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
  );
});
