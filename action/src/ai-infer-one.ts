// Per-suggestion AI inference — ONE focal point per invocation.
//
// argv[2] = focal index (0-based). Builds a tiny prompt for that one
// scanner finding, POSTs a single GitHub Models request, parses the
// reply, and APPENDS the resulting suggestion (if it clears the quality
// bar) to the shared envelope at AI_OUT. The bash `for` loop in
// action.yml invokes this once per focal point — sequentially, so the
// read-modify-write append is race-free.
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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as core from '@actions/core';
import { loadReport } from './report.ts';
import { buildFocalUserPrompt, FOCAL_SYSTEM_PROMPT } from './ai/focal-prompt.ts';
import { callModel } from './ai/models-client.ts';
import { parseAIOutput } from './ai/parse.ts';
import type { AISuggestionEnvelope } from './ai/schema.ts';

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readEnvelope(path: string): AISuggestionEnvelope {
  try {
    if (existsSync(path)) {
      const j = JSON.parse(readFileSync(path, 'utf8')) as AISuggestionEnvelope;
      if (Array.isArray(j?.suggestions)) return j;
    }
  } catch {
    // fall through to a fresh envelope
  }
  return { suggestions: [] };
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function main(): Promise<void> {
  const idx = Number.parseInt(process.argv[2] ?? '', 10);
  const outPath = process.env.AI_OUT ?? '';
  const reportPath = process.env.DRIFT_REPORT_PATH ?? '';
  const endpoint = process.env.AI_ENDPOINT ?? '';
  const model = process.env.AI_MODEL || 'openai/gpt-4o';
  const token = process.env.GITHUB_TOKEN ?? '';
  const workspaceRoot = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const baseSha = process.env.AI_BASE_SHA ?? '';
  const headSha = process.env.AI_HEAD_SHA ?? '';
  const maxOutputTokens = intEnv('AI_MAX_OUTPUT_TOKENS', 4000);

  const label = Number.isInteger(idx) ? `#${idx + 1}` : '?';

  if (!Number.isInteger(idx) || idx < 0) {
    core.warning(`ai-infer-one: bad focal index "${process.argv[2]}".`);
    return;
  }
  if (!outPath || !endpoint || !token) {
    core.warning('ai-infer-one: missing AI_OUT / AI_ENDPOINT / GITHUB_TOKEN.');
    return;
  }
  if (!existsSync(reportPath)) {
    core.warning(`ai-infer-one: no report at ${reportPath}.`);
    return;
  }

  let report;
  try {
    report = loadReport(reportPath);
  } catch (e) {
    core.warning(`ai-infer-one: report unreadable: ${describe(e)}`);
    return;
  }

  const user = buildFocalUserPrompt(report, idx, { workspaceRoot, baseSha, headSha });
  if (!user) {
    core.info(`focal ${label}: no focal point at this index — skipping.`);
    return;
  }

  let content: string;
  try {
    content = await callModel({
      endpoint,
      token,
      model,
      system: FOCAL_SYSTEM_PROMPT,
      user,
      maxOutputTokens,
    });
  } catch (e) {
    core.warning(`focal ${label}: inference failed (${describe(e)}).`);
    return;
  }

  const parsed = parseAIOutput(content);
  if (!parsed.ok) {
    core.warning(`focal ${label}: output rejected — ${parsed.reason}`);
    return;
  }
  const suggestion = parsed.suggestions[0];
  if (!suggestion) {
    core.info(`focal ${label}: ${parsed.total} candidate(s) → 0 cleared the bar.`);
    return;
  }

  // Sequential bash loop ⇒ no concurrent writers ⇒ plain read-append-write.
  const envelope = readEnvelope(outPath);
  envelope.suggestions.push(suggestion);
  writeFileSync(outPath, JSON.stringify(envelope));
  core.info(`focal ${label}: +1 suggestion → ${suggestion.file}:${suggestion.line}`);
}

main().catch((err) => {
  core.warning(`ai-infer-one fatal (non-fatal to the action): ${describe(err)}`);
});
