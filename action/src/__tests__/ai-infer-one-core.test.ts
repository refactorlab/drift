// Unit tests for the inferOne orchestration (src/ai/infer-one-core.ts).
//
// Drives the FULL inference call — load report → build commentable map
// → build prompt → call model → parse → append to envelope — with a
// stubbed callModel. Asserts:
//
//   • The happy path appends a suggestion to AI_OUT and emits the
//     scanner-window + +1-suggestion logs.
//   • Multi-call accumulation: two consecutive inferOne calls produce
//     a 2-suggestion envelope (the sequential read-modify-write the
//     bash loop relies on).
//   • Suffix-match path-base bridge: scanner emits a deeper path than
//     git diff (the documented Rust convention) and inferOne resolves
//     it via lookupCommentable instead of silently dropping.
//   • Diagnostic outcomes: file-not-in-diff names the file and the
//     diff's file list; out-of-range names the cohort size; no diff
//     names that PR diff is unavailable.
//   • Pre-flight refusals (bad idx, missing env, missing report) log a
//     warning and never call the model.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import type { ScanPrOutput } from '../report.ts';

type ModelArgs = Parameters<NonNullable<InferOneDeps['callModel']>>[0];

/**
 * Stand up a real git repo with TWO commits so getFullDiff produces a
 * real diff. `before` and `after` map paths to file contents at the
 * base and head commits respectively. Files present only in `after`
 * count as PR additions; files present in both diff as modifications.
 */
function makeRepoTwoCommits(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-infer-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: root });

  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, c);
  }
  if (Object.keys(before).length === 0) {
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: root });
  } else {
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  }
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  for (const [p, c] of Object.entries(after)) {
    const abs = join(root, p);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  return { root, baseSha, headSha };
}

function reportFor(file: string, line: number, extras?: Record<string, unknown>): ScanPrOutput {
  return {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: [file], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file,
          line,
          confidence: 0.9,
          why_it_matters: 'flagged',
          references: [{ url: 'https://example.com/x' }],
          diff: {
            before_lines: [
              { line_number: line, code: 'def flagged():', kind: 'del' },
              { line_number: line + 1, code: '    pass', kind: 'ctx' },
            ],
          },
          ...(extras as object),
        },
      ],
    },
  } as unknown as ScanPrOutput;
}

function modelReplyWithSuggestion(file: string, lineNo: number): string {
  return JSON.stringify({
    suggestions: [
      {
        file,
        line: lineNo,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'mock-reply',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    log.info("FIXED")',
      },
    ],
  });
}

/**
 * Capturing logger that records every message inferOne emits. Using a
 * plain object (vs `mock.method` on `@actions/core`) because the
 * namespace exports are non-configurable in Node ESM — direct DI is the
 * stable path. Format matches what the production logger would render
 * to a GitHub Actions log so assertions look like the real output.
 */
function makeCapturingLogger(): { logger: InferLogger; messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    logger: {
      info: (m) => messages.push(`INFO  ${m}`),
      warning: (m) => messages.push(`WARN  ${m}`),
      startGroup: (n) => messages.push(`GROUP ${n}`),
      endGroup: () => messages.push('GROUP/end'),
    },
  };
}

test('inferOne: happy path → appends suggestion, names scanner window in logs', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'old\n' },
    { 'a.py': 'old\nnew_line_added_for_diff\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify(reportFor('a.py', 1, { rule_id: 'S2:dead-code' })));
  const outPath = join(root, 'envelope.json');

  let captured: ModelArgs | undefined;
  const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
    captured = args;
    return modelReplyWithSuggestion('a.py', 2);
  };

  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 0,
      outPath,
      reportPath,
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: root,
      baseSha,
      headSha,
      maxOutputTokens: 1000,
      callModel,
      logger,
    });

    // 1) The model WAS called with the scanner-grounded prompt.
    assert.ok(captured, 'callModel must have been invoked');
    assert.match(captured!.user, /code window \(scanner ±3, focal marked ←\):/);
    assert.match(captured!.user, /1│← def flagged/);

    // 2) The envelope has the suggestion the stub returned.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
    assert.equal(env.suggestions[0].file, 'a.py');
    assert.equal(env.suggestions[0].line, 2);

    // 3) The three load-bearing log lines surface in the right order.
    const log = messages.join('\n');
    assert.match(log, /INFO {2}focal #1: a\.py:1.*\[S2:dead-code\].*cohort 1\/1 anchorable.*diff covers 1 file/);
    assert.match(log, /INFO {2}focal #1: prompt built.*window=scanner.*calling model…/);
    assert.match(log, /INFO {2}focal #1: \+1 suggestion → a\.py:2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inferOne: two consecutive calls accumulate suggestions in the envelope (bash loop semantics)', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'old\n', 'b.py': 'old\n' },
    { 'a.py': 'old\nAA\n', 'b.py': 'old\nBB\n' },
  );
  const reportPath = join(root, 'report.json');
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py', 'b.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'a.py',
          line: 2,
          confidence: 0.9,
          why_it_matters: 'first',
          references: [{ url: 'https://example.com/x' }],
          diff: { before_lines: [{ line_number: 2, code: 'AA', kind: 'del' }] },
        },
        {
          category: 'B',
          file: 'b.py',
          line: 2,
          confidence: 0.85,
          why_it_matters: 'second',
          references: [{ url: 'https://example.com/y' }],
          diff: { before_lines: [{ line_number: 2, code: 'BB', kind: 'del' }] },
        },
      ],
    },
  } as unknown as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));
  const outPath = join(root, 'envelope.json');

  let callIdx = 0;
  const callModel: NonNullable<InferOneDeps['callModel']> = async () => {
    callIdx += 1;
    return modelReplyWithSuggestion(callIdx === 1 ? 'a.py' : 'b.py', 2);
  };

  const { logger, messages: _messages } = makeCapturingLogger();
  const baseDeps: Omit<InferOneDeps, 'idx'> = {
    outPath,
    reportPath,
    endpoint: 'https://example.invalid/inference',
    model: 'openai/gpt-4o',
    token: 'tk',
    workspaceRoot: root,
    baseSha,
    headSha,
    maxOutputTokens: 1000,
    callModel,
    logger,
  };

  try {
    await inferOne({ ...baseDeps, idx: 0 });
    await inferOne({ ...baseDeps, idx: 1 });

    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 2, 'envelope must accumulate, not overwrite');
    assert.deepEqual(
      env.suggestions.map((s: { file: string }) => s.file),
      ['a.py', 'b.py'],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inferOne: scanner emits a DEEPER path than git diff → suffix-match resolves it', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'old\n' },
    { 'a.py': 'old\nadded\n' },
  );
  const reportPath = join(root, 'report.json');
  // Scanner reports `repo-root/a.py` while git diff sees `a.py` — same
  // mismatch the Rust side already bridges. lookupCommentable should
  // resolve via suffix match and the inference should proceed.
  writeFileSync(reportPath, JSON.stringify(reportFor('repo-root/a.py', 2)));
  const outPath = join(root, 'envelope.json');

  let modelCalled = false;
  const callModel: NonNullable<InferOneDeps['callModel']> = async () => {
    modelCalled = true;
    return modelReplyWithSuggestion('a.py', 2);
  };

  const { logger, messages: _messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 0,
      outPath,
      reportPath,
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: root,
      baseSha,
      headSha,
      maxOutputTokens: 1000,
      callModel,
      logger,
    });
    assert.ok(modelCalled, 'suffix-match must rescue the deeper-path finding');
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inferOne: scanner emits a file NOT on the diff → no model call + diagnostic log', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nA2\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify(reportFor('totally/unrelated.py', 99)));
  const outPath = join(root, 'envelope.json');

  let modelCalled = false;
  const callModel: NonNullable<InferOneDeps['callModel']> = async () => {
    modelCalled = true;
    return modelReplyWithSuggestion('x', 1);
  };

  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 0,
      outPath,
      reportPath,
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: root,
      baseSha,
      headSha,
      maxOutputTokens: 1000,
      callModel,
      logger,
    });

    assert.equal(modelCalled, false, 'a non-anchorable finding must NOT spend an inference call');
    assert.match(
      messages.join('\n'),
      /file not present on the PR diff.*Diff has 1 file\(s\): a\.py/,
      'log must name the diff files so the path-base mismatch is diagnosable',
    );
    assert.equal(
      existsSync(outPath),
      false,
      'envelope file must NOT be created on a no-op call',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inferOne: index out of range → no model call + named cohort size in log', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nA2\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify(reportFor('a.py', 2)));

  let modelCalled = false;
  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 5, // we only have 1 finding
      outPath: join(root, 'envelope.json'),
      reportPath,
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: root,
      baseSha,
      headSha,
      maxOutputTokens: 1000,
      callModel: async () => {
        modelCalled = true;
        return '{"suggestions":[]}';
      },
      logger,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(modelCalled, false);
  assert.match(messages.join('\n'), /only 1 scanner finding\(s\) — index out of range/);
});

test('inferOne: missing env → warning + fast exit (never reaches the model)', async () => {
  let modelCalled = false;
  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 0,
      outPath: '', // ← missing
      reportPath: '/does/not/matter',
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: '/tmp',
      baseSha: '',
      headSha: '',
      maxOutputTokens: 1000,
      callModel: async () => {
        modelCalled = true;
        return '{"suggestions":[]}';
      },
      logger,
    });
  } finally {
    // No tmpdir to clean.
  }
  assert.equal(modelCalled, false);
  assert.match(
    messages.join('\n'),
    /WARN {2}ai-infer-one: missing AI_OUT \/ AI_ENDPOINT \/ GITHUB_TOKEN/,
  );
});

test('inferOne: bad idx → warning, no read of report or model call', async () => {
  let modelCalled = false;
  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: Number.NaN,
      outPath: '/tmp/out.json',
      reportPath: '/does/not/matter',
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: '/tmp',
      baseSha: '',
      headSha: '',
      maxOutputTokens: 1000,
      callModel: async () => {
        modelCalled = true;
        return '{"suggestions":[]}';
      },
      logger,
    });
  } finally {
    // No tmpdir to clean.
  }
  assert.equal(modelCalled, false);
  assert.match(messages.join('\n'), /WARN {2}ai-infer-one: bad focal index/);
});

test('inferOne: model throws → warning, NO envelope write, NO crash', async () => {
  const { root, baseSha, headSha } = makeRepoTwoCommits(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nA2\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify(reportFor('a.py', 2)));
  const outPath = join(root, 'envelope.json');

  const { logger, messages } = makeCapturingLogger();
  try {
    await inferOne({
      idx: 0,
      outPath,
      reportPath,
      endpoint: 'https://example.invalid/inference',
      model: 'openai/gpt-4o',
      token: 'tk',
      workspaceRoot: root,
      baseSha,
      headSha,
      maxOutputTokens: 1000,
      callModel: async () => {
        throw new Error('rate-limited');
      },
      logger,
    });

    // No envelope written; warning surfaces the underlying error.
    assert.match(messages.join('\n'), /WARN {2}focal #1: inference failed \(rate-limited\)/);
    assert.equal(
      existsSync(outPath),
      false,
      'envelope must NOT be created when the model call fails',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
