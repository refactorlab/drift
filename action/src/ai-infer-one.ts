// Per-suggestion AI inference — ONE focal point per invocation. CLI
// wrapper around `ai/infer-one-core.ts` (where the orchestration
// lives). This file does ONE job: read the environment + argv,
// translate them into `InferOneDeps`, and hand off. All testable logic
// is in the core module; tests never need to import this file (which
// would auto-run `main()` at module load).
//
// argv[2] = focal index (0-based). The bash `for` loop in action.yml
// invokes this once per focal point — sequentially, so the
// read-modify-write envelope append in inferOne is race-free.
//
// Fail-soft: any error logs a warning and exits 0. The deterministic
// scanner review (dist/index.js) has already been posted, and one bad
// focal point must not sink the others.
//
// Env:
//   AI_OUT               — envelope file to append to ({suggestions:[…]})
//   DRIFT_REPORT_PATH    — scanner report JSON (source of focal points)
//   AI_ENDPOINT          — resolved Models endpoint (…/inference)
//   AI_MODEL             — model id (e.g. openai/gpt-5)
//   AI_MAX_OUTPUT_TOKENS — per-call output budget (default 4000)
//   AI_BASE_SHA / AI_HEAD_SHA — diff range
//   GITHUB_WORKSPACE     — checkout root (source for code windows)
//   GITHUB_TOKEN         — auth

import * as core from '@actions/core';
import { inferOne } from './ai/infer-one-core.ts';

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function main(): Promise<void> {
  await inferOne({
    idx: Number.parseInt(process.argv[2] ?? '', 10),
    outPath: process.env.AI_OUT ?? '',
    reportPath: process.env.DRIFT_REPORT_PATH ?? '',
    endpoint: process.env.AI_ENDPOINT ?? '',
    model: process.env.AI_MODEL || 'openai/gpt-4o',
    token: process.env.GITHUB_TOKEN ?? '',
    workspaceRoot: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    baseSha: process.env.AI_BASE_SHA ?? '',
    headSha: process.env.AI_HEAD_SHA ?? '',
    maxOutputTokens: intEnv('AI_MAX_OUTPUT_TOKENS', 4000),
  });
}

main().catch((err) => {
  core.warning(`ai-infer-one fatal (non-fatal to the action): ${describe(err)}`);
});
