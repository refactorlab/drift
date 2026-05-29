// Edge-case + stress + cross-path tests for the per-suggestion AI loop.
//
// What this bracketed end-to-end is missing without these tests:
//
//   1. Deterministic-review path (buildAIContext) — shares
//      pickFocalSuggestions / renderFocalPoint with the AI loop. Our
//      file-level filter + scanner-window changes MUST work in both
//      consumers; otherwise the sticky-comment review and the inline
//      suggestions drift out of sync.
//   2. Stress: 50 findings — inferOne is sequential per finding, but
//      pickFocalSuggestions sorts them every call. Verify scaling is
//      sub-linear-ish (loose bound) and every iteration is correct.
//   3. Forward-compat: a scanner update may add new fields the TS
//      type doesn't model. The Action MUST ignore unknown keys and
//      proceed — never crash on a schema-additive change.
//   4. Pathological paths: unicode, leading `./`, deeply nested
//      directory trees. Suffix-match has to bridge them all.
//   5. Token-budget overflow: a degenerate huge file diff. The
//      annotateFocusedDiff loop has a "if even the tightest window
//      is over budget, send it anyway" fail-soft. Test we don't
//      crash + that the bundle still produces SOMETHING.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAIContext } from '../ai/build-context.ts';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import type { ScanPrOutput } from '../report.ts';

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-edge-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
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
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

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

// ─── 1. Deterministic-review path shares the same filter + renderer ────

test('deterministic review: buildAIContext also uses scanner before_lines + file-level filter', () => {
  // The sticky-comment review (dist/index.js entry → buildAIContext)
  // shares pickFocalSuggestions and renderFocalPoint with the AI
  // loop. Same input that survives the AI loop must also surface in
  // the deterministic context — or the two output channels diverge.
  const { root, baseSha, headSha } = makeRepo(
    { 'svc/x.py': 'def f():\n    pass\n' },
    { 'svc/x.py': 'def f():\n    pass\n    log.info("ADDED")\n' },
  );
  const reportPath = join(root, 'report.json');
  // line 1 (`def f()`) is NOT a `+` line on the PR diff — only line 3
  // is. Under the OLD exact-line filter this finding was dropped;
  // under the file-level filter it survives in BOTH the AI loop and
  // the deterministic context.
  writeFileSync(
    reportPath,
    JSON.stringify({
      schema_version: '1.0',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: {
        changed_files: ['svc/x.py'],
        affected_roots: [],
        unreachable_changes: [],
      },
      pr_review: {
        code_suggestions: [
          {
            category: 'A',
            file: 'svc/x.py',
            line: 1,
            confidence: 0.9,
            why_it_matters: 'dead-code in changed file',
            references: [{ url: 'https://example.com/x' }],
            diff: {
              before_lines: [
                { line_number: 1, code: 'def f():', kind: 'del' },
                { line_number: 2, code: '    pass', kind: 'ctx' },
              ],
            },
          },
        ],
      },
    } satisfies ScanPrOutput),
  );

  try {
    const ctx = buildAIContext({
      reportPath,
      workspaceRoot: root,
      baseSha,
      headSha,
      maxFiles: 5,
      maxFocalPoints: 5,
      byteBudget: 80_000,
    });
    // The deterministic-review path uses NO commentable map —
    // pickFocalSuggestions returns everything. The scanner window
    // must still ground the focal section.
    assert.equal(ctx.focalPoints, 1);
    assert.match(ctx.text, /code window \(scanner ±3, focal marked ←\):/);
    assert.match(ctx.text, /1│← def f\(\):/);
    // And the PR diff still appears (the diff section the existing
    // tests cover stays present).
    assert.match(ctx.text, /=== PR diff \(/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 2. Stress: many findings, all anchorable ──────────────────────────

test('stress: 50 findings in 50 files — inferOne walks each, envelope grows linearly', async () => {
  const N = 50;
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (let i = 0; i < N; i += 1) {
    const p = `pkg/m${i}.py`;
    before[p] = 'def f():\n    pass\n';
    after[p] = `def f():\n    pass\n    log.info("ADD_${i}")\n`;
  }
  const { root, baseSha, headSha } = makeRepo(before, after);
  const reportPath = join(root, 'report.json');
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Object.keys(after),
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: N }, (_, i) => ({
        category: 'A' as const,
        file: `pkg/m${i}.py`,
        line: 1,
        confidence: 0.9 - i * 0.001, // strictly descending so sort order is stable
        why_it_matters: `finding number ${i} — surfaces in iteration i`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' as const }] },
      })),
    },
  } as unknown as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));
  const outPath = join(root, 'envelope.json');

  try {
    const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
      // Extract which iteration this is from the prompt — the focal
      // ordinal "[1]" is always 1 (single-finding prompt), but the
      // file name is unique per iteration.
      const m = args.user.match(/pkg\/m(\d+)\.py:/);
      const i = m ? Number(m[1]) : 0;
      return JSON.stringify({
        suggestions: [
          {
            file: `pkg/m${i}.py`,
            line: 3,
            category: 'A',
            confidence: 0.9,
            why_it_matters: `stubbed reply for iteration ${i}, longer than 10 chars`,
            references: [{ url: `https://example.com/r/${i}` }],
            after_code: `    log.info("FIXED_${i}")`,
          },
        ],
      });
    };
    const { logger } = captureLogger();

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

    const t0 = Date.now();
    for (let i = 0; i < N; i += 1) {
      await inferOne({ ...baseDeps, idx: i });
    }
    const elapsed = Date.now() - t0;

    // Every iteration appended exactly one suggestion → envelope of N.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, N, `envelope must have ${N} suggestions, got ${env.suggestions.length}`);
    // Confidence-descending order is preserved across all iterations
    // (highest confidence finding lands first).
    assert.equal(env.suggestions[0].file, 'pkg/m0.py');
    assert.equal(env.suggestions[N - 1].file, `pkg/m${N - 1}.py`);
    // Loose perf ceiling — every iteration runs getFullDiff (a real
    // `git diff`) + a sort, so disk I/O dominates. In isolation 50
    // iterations finish in ~7s; under `node --test` file-level
    // parallelism the same test contends with every other test file
    // doing git ops too, so the wall time can balloon 10×. The goal
    // here is "no quadratic surprise" — N findings should stay linear,
    // not turn N² — so we set a generous absolute ceiling. Tighten
    // only if a real algorithmic regression is hiding here.
    assert.ok(elapsed < 180_000, `50 iterations took ${elapsed}ms — investigate scaling`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 3. Forward-compat: unknown report fields don't break the action ───

test('forward-compat: scanner adds new top-level + nested fields → loadReport ignores them', async () => {
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADDED\n' },
  );
  const reportPath = join(root, 'report.json');
  // Hand-crafted report with unknown future fields at every level
  // we exposed in the TS schema. The TS loader is structurally typed
  // (it asserts presence of known REQUIRED fields, not absence of
  // extras), so the Action MUST tolerate this gracefully.
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.2',                          // also tests highest schema we support
    mode: 'static',
    generator: { tool: 't', version: '1' },
    // Unknown top-level future block — must NOT break load.
    quantum_metrics: { entanglement: 0.42 },
    pr_scope: {
      changed_files: ['a.py'],
      affected_roots: [],
      unreachable_changes: [],
      // Unknown future field nested under a known block.
      affinity_clusters: [{ name: 'c1', members: ['a.py'] }],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'a.py',
          line: 2,
          confidence: 0.9,
          why_it_matters: 'a real future-proof finding for the test',
          references: [{ url: 'https://example.com/x' }],
          diff: { before_lines: [{ line_number: 2, code: 'ADDED', kind: 'del' }] },
          // Unknown future field on the suggestion itself.
          fix_effort_minutes: 12,
          ai_remediation_v2: { strategy: 'rewrite', confidence: 0.85 },
        },
      ],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger } = captureLogger();
  let modelCalled = false;
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
        modelCalled = true;
        return JSON.stringify({
          suggestions: [{
            file: 'a.py', line: 2, category: 'A', confidence: 0.9,
            why_it_matters: 'future-compat stub reply, ≥10 chars',
            references: [{ url: 'https://example.com/x' }],
            after_code: '    fixed',
          }],
        });
      },
      logger,
    });
    assert.ok(modelCalled, 'unknown fields must NOT cause the report load to fail');
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 4. Pathological inputs: unicode, deep nesting, prefix mismatch ────

test('pathological paths: unicode + deeply nested + suffix-bridge — all anchored', async () => {
  // The file name contains unicode + spaces + a Windows-style
  // separator that gets sanitized into the real path. The scanner's
  // path emits a deeper prefix than `git diff --name-only` (the
  // documented mismatch); suffix-match must still resolve.
  const realPath = 'sub-dir/résumé módule.py';
  const { root, baseSha, headSha } = makeRepo(
    { [realPath]: 'def f():\n    pass\n' },
    { [realPath]: 'def f():\n    pass\n    log.info("ADDED")\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: [realPath],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          // Deeper prefix than git diff emits — suffix-match bridges.
          file: `monorepo/services/${realPath}`,
          line: 1,
          confidence: 0.9,
          why_it_matters: 'unicode-pathed finding, should still anchor',
          references: [{ url: 'https://example.com/x' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
      ],
    },
  }));
  const outPath = join(root, 'envelope.json');
  let captured: string | undefined;
  const { logger } = captureLogger();
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
      callModel: async (args) => {
        captured = args.user;
        return JSON.stringify({
          suggestions: [{
            file: realPath, line: 3, category: 'A', confidence: 0.9,
            why_it_matters: 'unicode reply, ≥10 chars',
            references: [{ url: 'https://example.com/x' }],
            after_code: '    fixed',
          }],
        });
      },
      logger,
    });
    assert.ok(captured, 'suffix-match must rescue the unicode-pathed finding');
    // The prompt carries the SCANNER's full path verbatim — proves
    // suffix-match resolved the filter without rewriting `s.file`.
    assert.match(captured!, new RegExp(`monorepo/services/sub-dir/`));
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 5. Token-budget overflow: huge diff still produces a prompt ───────

test('token budget: a multi-thousand-line file diff falls through to a fail-soft over-attempt', async () => {
  // Build a file with 8000 lines so even the tightest hunk window
  // (radius 8) is plausibly large. The buildFocalUserPrompt
  // fallback chain is `Infinity → 80 → 48 → 28 → 16 → 8`; if every
  // window is over budget, the last one is sent anyway. Our job here
  // is to verify that the function returns SOMETHING (never throws)
  // and that it still includes the scanner header + window.
  const big = Array.from({ length: 8000 }, (_, i) => `// line ${i + 1}`).join('\n') + '\n';
  const bigPlusOne = big + '// LAST_ADDED_LINE\n';
  const { root, baseSha, headSha } = makeRepo(
    { 'big.kt': big },
    { 'big.kt': bigPlusOne },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['big.kt'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'big.kt',
          line: 4000,
          confidence: 0.9,
          why_it_matters: 'somewhere in the middle of a huge file',
          references: [{ url: 'https://example.com/x' }],
          diff: {
            before_lines: [
              { line_number: 3999, code: '// line 3999', kind: 'ctx' },
              { line_number: 4000, code: '// line 4000', kind: 'del' },
              { line_number: 4001, code: '// line 4001', kind: 'ctx' },
            ],
          },
        },
      ],
    },
  }));
  const outPath = join(root, 'envelope.json');
  const { logger, messages } = captureLogger();
  let prompt: string | undefined;
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
      callModel: async (args) => {
        prompt = args.user;
        return JSON.stringify({
          suggestions: [{
            file: 'big.kt', line: 8001, category: 'A', confidence: 0.9,
            why_it_matters: 'over-budget reply still parses, ≥10 chars',
            references: [{ url: 'https://example.com/x' }],
            after_code: '// fixed',
          }],
        });
      },
      logger,
    });
    assert.ok(prompt, 'inferOne must build SOMETHING even over budget');
    // Scanner window + focal marker survived even on the over-budget
    // path — the marker is what gives the model an anchor.
    assert.match(prompt!, /code window \(scanner ±3, focal marked ←\):/);
    assert.match(prompt!, /4000│← \/\/ line 4000/);
    // Sanity: both breadcrumb log lines surfaced — the cohort line
    // names this iteration, and the prompt-built line confirms we
    // STILL took the scanner-window path on the over-budget fallback.
    const log = messages.join('\n');
    assert.match(log, /focal #1: big\.kt:4000.*cohort 1\/1 anchorable/);
    assert.match(log, /focal #1: prompt built.*window=scanner/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── 6. Bash-loop simulator: N subprocess invocations one after another ─

test('bash-loop semantics: sequential subprocess invocations are race-free + cumulative', async () => {
  // This re-asserts the action.yml contract: `for i in 0..N; do node
  // dist/ai-infer-one.js $i; done`. Each invocation reads the
  // envelope from disk, appends ONE suggestion, writes back. No
  // overlap because bash runs them sequentially. Failure mode this
  // catches: a future "optimization" that switches to background
  // jobs would race and corrupt AI_OUT; we'd want a test to catch
  // that ASAP.
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRootHere = resolve(here, '..', '..', '..');
  const bundle = resolve(repoRootHere, 'dist/ai-infer-one.js');
  if (!existsSync(bundle)) {
    // Bundle smoke test catches this — skip if we're somehow ahead of build.
    return;
  }

  const { createServer } = await import('node:http');
  const N = 4;

  const { root, baseSha, headSha } = makeRepo(
    Object.fromEntries(Array.from({ length: N }, (_, i) => [`f${i}.py`, 'a\n'])),
    Object.fromEntries(Array.from({ length: N }, (_, i) => [`f${i}.py`, `a\nFROM_${i}\n`])),
  );
  const reportPath = join(root, 'report.json');
  const report = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Array.from({ length: N }, (_, i) => `f${i}.py`),
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: N }, (_, i) => ({
        category: 'A',
        file: `f${i}.py`,
        line: 2,
        confidence: 0.9 - i * 0.01,
        why_it_matters: `finding ${i} — load-bearing message ≥10 chars`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 2, code: `FROM_${i}`, kind: 'del' }] },
      })),
    },
  };
  writeFileSync(reportPath, JSON.stringify(report));
  const outPath = join(root, 'envelope.json');

  // Stub server: respond to N calls.
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        suggestions: [{
          file: 'unused', line: 2, category: 'A', confidence: 0.9,
          why_it_matters: 'stubbed reply for the bash-loop test',
          references: [{ url: 'https://example.com/x' }],
          after_code: '    fixed',
        }],
      }) } }],
    }));
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const port = (server.address() as any).port;

  const runOnce = (idx: number) => new Promise<{ code: number | null; stdout: string }>((resolve_, reject) => {
    const proc = spawn(process.execPath, [bundle, String(idx)], {
      cwd: root,
      env: {
        ...process.env,
        AI_OUT: outPath,
        DRIFT_REPORT_PATH: reportPath,
        AI_ENDPOINT: `http://127.0.0.1:${port}`,
        AI_MODEL: 'openai/gpt-4o',
        GITHUB_TOKEN: 'test-token',
        GITHUB_WORKSPACE: root,
        AI_BASE_SHA: baseSha,
        AI_HEAD_SHA: headSha,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.on('exit', (code) => resolve_({ code, stdout }));
    proc.on('error', reject);
  });

  try {
    // Sequential — exactly like action.yml's bash `for` loop.
    for (let i = 0; i < N; i += 1) {
      const r = await runOnce(i);
      assert.equal(r.code, 0, `iteration ${i} failed:\n${r.stdout}`);
    }
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, N, 'envelope must have one entry per bash-loop iteration');
  } finally {
    await new Promise<void>((rs) => server.close(() => rs()));
    rmSync(root, { recursive: true, force: true });
  }
});
