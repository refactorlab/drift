// Tests for the per-suggestion inference loop building blocks:
//   - models-client: reasoning-model detection + the param it sends
//     (max_completion_tokens for gpt-5 vs max_tokens for gpt-4o — the
//     gpt-5 fix), endpoint shaping, and non-200 error surfacing.
//   - focal-prompt: one-finding prompt construction + index bounds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isReasoningModel, callModel } from '../ai/models-client.ts';
import { buildFocalUserPrompt } from '../ai/focal-prompt.ts';
import type { ScanPrOutput } from '../report.ts';

test('isReasoningModel: gpt-5 / o-series are reasoning; gpt-4o is not', () => {
  for (const m of ['openai/gpt-5', 'gpt-5', 'openai/gpt-5-mini', 'openai/o1', 'o3-mini', 'openai/o4-mini']) {
    assert.equal(isReasoningModel(m), true, `${m} should be reasoning`);
  }
  for (const m of ['openai/gpt-4o', 'gpt-4o', 'openai/gpt-4o-mini', 'meta/llama-3']) {
    assert.equal(isReasoningModel(m), false, `${m} should NOT be reasoning`);
  }
});

async function captureCall(model: string): Promise<{ url: string; body: Record<string, unknown> }> {
  const orig = globalThis.fetch;
  let captured: { url: string; body: Record<string, unknown> } = { url: '', body: {} };
  globalThis.fetch = (async (url: string, opts: { body: string }) => {
    captured = { url, body: JSON.parse(opts.body) };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '{"suggestions":[]}' } }] }),
    };
  }) as unknown as typeof fetch;
  try {
    await callModel({
      endpoint: 'https://x/inference/', // trailing slash on purpose
      token: 't',
      model,
      system: 's',
      user: 'u',
      maxOutputTokens: 4321,
    });
  } finally {
    globalThis.fetch = orig;
  }
  return captured;
}

test('callModel: gpt-5 sends max_completion_tokens (not max_tokens) + trims endpoint slash', async () => {
  const { url, body } = await captureCall('openai/gpt-5');
  assert.equal(url, 'https://x/inference/chat/completions');
  assert.equal(body.max_completion_tokens, 4321);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.model, 'openai/gpt-5');
  const messages = body.messages as { role: string }[];
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
});

test('callModel: gpt-4o sends max_tokens (not max_completion_tokens)', async () => {
  const { body } = await captureCall('openai/gpt-4o');
  assert.equal(body.max_tokens, 4321);
  assert.equal(body.max_completion_tokens, undefined);
});

test('callModel: non-200 throws with status + body snippet', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: false,
    status: 403,
    text: async () => 'no models: read scope',
  })) as unknown as typeof fetch;
  try {
    await assert.rejects(
      () =>
        callModel({
          endpoint: 'https://x/inference',
          token: 't',
          model: 'openai/gpt-5',
          system: 's',
          user: 'u',
          maxOutputTokens: 10,
        }),
      /403.*no models/,
    );
  } finally {
    globalThis.fetch = orig;
  }
});

function reportWith(file: string, line: number): ScanPrOutput {
  return {
    pr_review: {
      code_suggestions: [
        {
          file,
          line,
          category: 'A',
          confidence: 0.9,
          why_it_matters: 'hot loop allocation',
          references: [{ url: 'https://example.com/doc' }],
        },
      ],
    },
  } as unknown as ScanPrOutput;
}

test('buildFocalUserPrompt: builds a one-finding prompt for a valid index', () => {
  // A real (non-git) dir → getPrDiff fails gracefully → "(no diff available)",
  // but the focal-point section is still emitted.
  const root = mkdtempSync(join(tmpdir(), 'drift-focal-'));
  const out = buildFocalUserPrompt(reportWith('src/a.ts', 10), 0, {
    workspaceRoot: root,
    baseSha: 'a',
    headSha: 'b',
  });
  assert.ok(out, 'expected a prompt string');
  assert.match(out, /Focal point/);
  assert.match(out, /src\/a\.ts:10/);
});

test('buildFocalUserPrompt: returns null for an out-of-range index', () => {
  const out = buildFocalUserPrompt(reportWith('src/a.ts', 10), 5, {
    workspaceRoot: tmpdir(),
    baseSha: 'a',
    headSha: 'b',
  });
  assert.equal(out, null);
});
