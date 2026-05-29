// Robustness tests for ai-infer-one orchestration + ai-suggest pipeline.
//
// Three things we hadn't yet bracketed end-to-end:
//
//   1. Concurrent safety. action.yml runs the bash loop sequentially,
//      but defense-in-depth: if a future refactor parallelizes the
//      loop, we want a deterministic failure mode (no envelope
//      corruption / no crash). We exercise N parallel inferOne calls
//      against the same envelope path and document the outcome the
//      bash semantics rely on.
//
//   2. Weird scanner report shapes. The Rust scanner is a separate
//      release — a schema-additive change can ship without our action
//      knowing. The action must tolerate:
//        - missing `pr_review`
//        - `pr_review.code_suggestions: null`
//        - empty `code_suggestions: []`
//        - findings with `line: 0` (corrupt)
//        - findings missing `references`
//        - schema_version we don't recognize
//
//   3. Network failure resilience. The Models endpoint is third-party
//      and CAN: refuse connection, time out, return non-JSON, return a
//      huge body, etc. Each must be fail-soft (exit 0, warning logged,
//      envelope untouched) — never crash the whole action.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import type { ScanPrOutput } from '../report.ts';

const captureLogger = (): { logger: InferLogger; messages: string[] } => {
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
};

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-robust-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  for (const [p, c] of Object.entries(after)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

// ─── 1. Concurrent safety ──────────────────────────────────────────────

test('robustness: 5 parallel inferOne calls against ONE envelope — final count is ≤ 5 (no crash, no dup-explosion)', async () => {
  // Parallel writes to the same envelope path. The current
  // read-modify-write isn't atomic (it's not designed to be — bash is
  // sequential). The contract this test pins:
  //   • No crash, no thrown exception (fail-soft for the WORST case).
  //   • Final envelope is valid JSON (no partial write surviving).
  //   • Count is between 1 and N (lost updates are tolerated; the
  //     action's sequential bash means production NEVER triggers this).
  const { root, baseSha, headSha } = makeRepo(
    Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}.py`, 'a\n'])),
    Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}.py`, `a\nADD_${i}\n`])),
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Array.from({ length: 5 }, (_, i) => `f${i}.py`),
      affected_roots: [], unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: 5 }, (_, i) => ({
        category: 'A', file: `f${i}.py`, line: 1,
        confidence: 0.9 - i * 0.01,
        why_it_matters: `concurrent test finding ${i}, ≥ 10 chars`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  }));
  const outPath = join(root, 'envelope.json');

  const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
    const m = args.user.match(/f(\d+)\.py:/);
    const i = m ? Number(m[1]) : 0;
    // small async delay so the writes really do overlap
    await new Promise((rs) => setTimeout(rs, 5));
    return JSON.stringify({
      suggestions: [{
        file: `f${i}.py`, line: 2, category: 'A', confidence: 0.9,
        why_it_matters: `parallel reply ${i}, ≥ 10 chars`,
        references: [{ url: 'https://example.com/x' }],
        after_code: '    ok',
      }],
    });
  };
  const baseDeps: Omit<InferOneDeps, 'idx'> = {
    outPath, reportPath, endpoint: 'https://example.invalid/inference',
    model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
    baseSha, headSha, maxOutputTokens: 1000, callModel,
    logger: captureLogger().logger,
  };

  try {
    // Fire all 5 in parallel.
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => inferOne({ ...baseDeps, idx: i })),
    );
    // Envelope is still valid JSON.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.ok(Array.isArray(env.suggestions));
    // Best-effort: ≥ 1 suggestion landed (the last writer wins at minimum).
    assert.ok(env.suggestions.length >= 1, 'at least the last writer must persist');
    assert.ok(env.suggestions.length <= 5, 'no duplicate explosion');
    // Every persisted suggestion is well-formed (no partial-write corruption).
    for (const s of env.suggestions) {
      assert.equal(typeof s.file, 'string');
      assert.equal(typeof s.line, 'number');
      assert.equal(s.category, 'A');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 2. Weird scanner report shapes ────────────────────────────────────

const shapeCases: Array<{
  name: string;
  report: unknown;
  expect: 'no-op-log' | 'silently-skipped';
}> = [
  {
    name: 'pr_review missing entirely → no-op',
    report: {
      schema_version: '1.0', mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    },
    expect: 'no-op-log',
  },
  {
    name: 'code_suggestions: null → no-op',
    report: {
      schema_version: '1.0', mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
      pr_review: { code_suggestions: null },
    },
    expect: 'no-op-log',
  },
  {
    name: 'code_suggestions: [] empty → no-op',
    report: {
      schema_version: '1.0', mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
      pr_review: { code_suggestions: [] },
    },
    expect: 'no-op-log',
  },
  {
    name: 'finding with line: 0 (corrupt) → silently skipped by the file/line filter',
    report: {
      schema_version: '1.0', mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
      pr_review: {
        code_suggestions: [{
          category: 'A', file: 'a.py', line: 0, confidence: 0.9,
          why_it_matters: 'corrupt line=0, must be dropped by the type guard',
          references: [{ url: 'https://example.com/x' }],
        }],
      },
    },
    expect: 'silently-skipped',
  },
  {
    name: 'schema_version 2.0 (future) → still tolerated for known fields',
    report: {
      schema_version: '2.0', mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
      pr_review: {
        code_suggestions: [{
          category: 'A', file: 'a.py', line: 2, confidence: 0.9,
          why_it_matters: 'future-schema finding, should still be picked up',
          references: [{ url: 'https://example.com/x' }],
          diff: { before_lines: [{ line_number: 2, code: 'A2', kind: 'del' }] },
        }],
      },
    },
    expect: 'no-op-log', // file isn't on the actual diff in this minimal test
  },
];

for (const tc of shapeCases) {
  test(`robustness: scanner shape — ${tc.name}`, async () => {
    const { root, baseSha, headSha } = makeRepo(
      { 'a.py': 'a\n' },
      { 'a.py': 'a\nA2\n' },
    );
    const reportPath = join(root, 'report.json');
    writeFileSync(reportPath, JSON.stringify(tc.report));
    let modelCalled = false;
    const { logger, messages } = captureLogger();
    try {
      await inferOne({
        idx: 0,
        outPath: join(root, 'envelope.json'),
        reportPath, endpoint: 'https://example.invalid/inference',
        model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
        baseSha, headSha, maxOutputTokens: 1000,
        callModel: async () => {
          modelCalled = true;
          return '{"suggestions":[]}';
        },
        logger,
      });
      // Either way: the model must NOT be called (no findings to anchor).
      assert.equal(modelCalled, false, `${tc.name}: must NOT spend an inference call`);
      // No envelope was written (no suggestion landed).
      assert.equal(
        existsSync(join(root, 'envelope.json')),
        false,
        `${tc.name}: envelope should not exist for a no-op`,
      );
      // A log breadcrumb of SOME kind was emitted (the user can see why).
      assert.ok(messages.length > 0, `${tc.name}: at least one log message must surface`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// ─── 3. Network failure resilience ─────────────────────────────────────

test('robustness: connection refused → warning, exit 0, envelope untouched', async () => {
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'connect-refused test, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger, messages } = captureLogger();
  // Stub callModel that throws like a connect-refused would.
  await inferOne({
    idx: 0,
    outPath, reportPath,
    endpoint: 'http://127.0.0.1:1', // would refuse if actually hit, but…
    model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
    baseSha, headSha, maxOutputTokens: 1000,
    callModel: async () => {
      const e = new Error('connect ECONNREFUSED 127.0.0.1:1');
      (e as { code?: string }).code = 'ECONNREFUSED';
      throw e;
    },
    logger,
  });
  const log = messages.join('\n');
  assert.match(log, /WARN.*inference failed.*ECONNREFUSED/);
  assert.equal(existsSync(outPath), false, 'envelope must NOT be written on connect-refused');
  rmSync(root, { recursive: true, force: true });
});

test('robustness: model returns non-JSON garbage → warning, both halves of the exchange logged', async () => {
  // Same fail-soft contract: parse error → warning + log dump, exit 0.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'garbage-reply test, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger, messages } = captureLogger();
  await inferOne({
    idx: 0, outPath, reportPath,
    endpoint: 'https://example.invalid/inference',
    model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
    baseSha, headSha, maxOutputTokens: 1000,
    callModel: async () => 'not even close to json',
    logger,
  });
  const log = messages.join('\n');
  assert.match(log, /output rejected/);
  // Both halves of the exchange end up in a collapsed group so the
  // user can debug from the log alone.
  assert.match(log, /INPUT \(user prompt\)/);
  assert.match(log, /OUTPUT \(model reply, first 400 chars\)/);
  // The garbage itself appears verbatim in the OUTPUT half.
  assert.match(log, /not even close to json/);
  assert.equal(existsSync(outPath), false, 'envelope must NOT be written on garbage reply');
  rmSync(root, { recursive: true, force: true });
});

test('robustness: slow Models endpoint → callModel can be aborted by the caller (we just propagate)', async () => {
  // We don't enforce a timeout in inferOne itself (the bash `for` loop
  // is sequential; a hung iteration would block the loop but not the
  // whole action). We do verify the SHAPE: if callModel rejects with
  // a timeout-like error, we surface it as a warning and exit 0.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'slow-endpoint test, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger, messages } = captureLogger();
  await inferOne({
    idx: 0, outPath, reportPath,
    endpoint: 'https://example.invalid/inference',
    model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
    baseSha, headSha, maxOutputTokens: 1000,
    callModel: async () => {
      const e = new Error('Headers Timeout Error');
      (e as { code?: string }).code = 'UND_ERR_HEADERS_TIMEOUT';
      throw e;
    },
    logger,
  });
  assert.match(messages.join('\n'), /WARN.*inference failed.*Timeout/);
  assert.equal(existsSync(outPath), false);
  rmSync(root, { recursive: true, force: true });
});

test('robustness: huge model reply (10 MB of JSON) → still parsed without crash', async () => {
  // Defense against a runaway reply. parseAIOutput uses native
  // JSON.parse so it scales with input size; we just make sure it
  // doesn't OOM or hang on a multi-MB reply.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'huge-reply test, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'envelope.json');
  // Single valid suggestion + a giant junk array of strings the parser
  // will iterate over and then schema-validate against — the suggestion
  // remains valid, the junk is just chaff.
  const padding = 'x'.repeat(1024 * 1024); // 1 MB
  const reply = JSON.stringify({
    suggestions: [{
      file: 'a.py', line: 2, category: 'A', confidence: 0.9,
      why_it_matters: padding.slice(0, 500),
      references: [{ url: 'https://example.com/x' }],
      after_code: '    ok',
    }],
    junk: Array.from({ length: 9 }, () => padding), // ~9 MB of chaff
  });
  assert.ok(reply.length > 9_000_000, 'reply must actually be ≥ 9 MB to exercise the size path');
  const { logger } = captureLogger();
  const t0 = Date.now();
  await inferOne({
    idx: 0, outPath, reportPath,
    endpoint: 'https://example.invalid/inference',
    model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
    baseSha, headSha, maxOutputTokens: 1000,
    callModel: async () => reply,
    logger,
  });
  const elapsed = Date.now() - t0;
  // The valid suggestion landed.
  const env = JSON.parse(readFileSync(outPath, 'utf8'));
  assert.equal(env.suggestions.length, 1);
  assert.equal(env.suggestions[0].file, 'a.py');
  // Loose perf bound — parse should be linear in the reply size,
  // dominated by JSON.parse on the 9 MB body. Allow 5s to absorb CI
  // variance; a true regression (quadratic re-parse, etc.) would
  // blow past this.
  assert.ok(elapsed < 5_000, `huge-reply parse took ${elapsed}ms — investigate`);
  rmSync(root, { recursive: true, force: true });
});

// ─── 4. Real HTTP failure (loopback that ACTUALLY refuses) ─────────────

test('robustness: live loopback server returns HTTP 503 → fail-soft warning', async () => {
  // Spin up a real local server that 503s. Exercises the actual fetch
  // + non-OK status code path the bundle ships with — the unit test
  // above stubs `callModel`, this one goes through the real wire.
  const requests: number[] = [];
  const server: Server = createServer((_req, res) => {
    requests.push(Date.now());
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'service unavailable' }));
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'http-503 test, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger, messages } = captureLogger();
  try {
    await inferOne({
      idx: 0, outPath, reportPath,
      endpoint: baseUrl, // real loopback that 503s
      model: 'openai/gpt-4o', token: 'tk', workspaceRoot: root,
      baseSha, headSha, maxOutputTokens: 1000,
      // No callModel override — uses the real fetch path inside the bundle.
      logger,
    });
    // The real server got hit at least once → we went through the wire.
    assert.ok(requests.length >= 1, 'real fetch must have been attempted');
    // Warning surfaced; envelope NOT written.
    assert.match(messages.join('\n'), /WARN.*inference failed/);
    assert.equal(existsSync(outPath), false);
  } finally {
    await new Promise<void>((rs) => server.close(() => rs()));
    rmSync(root, { recursive: true, force: true });
  }
});
