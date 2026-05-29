// Downstream integration: an envelope WRITTEN by inferOne must flow
// cleanly through the ai-suggest post layer. The existing
// ai-pipeline.test.ts uses a static example fixture; here we close
// the loop by FIRST producing the envelope with the real inferOne
// (against a real git repo + stubbed model) and SECOND running that
// envelope through `parseAIOutput → filterByDiff → buildReviewComments`.
//
// What this catches: a future change to the envelope shape (e.g.
// renaming `suggestions`, dropping a field, changing the `references`
// shape) that the inferOne writer + the ai-suggest reader could drift
// on independently. The pipeline test would still pass against the
// static fixture; this test fails the moment the writer/reader pair
// disagree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import { parseAIOutput } from '../ai/parse.ts';
import { filterByDiff } from '../ai/diff-lines.ts';
import { buildReviewComments } from '../ai/post.ts';
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
  const root = mkdtempSync(join(tmpdir(), 'drift-downstream-'));
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

test('envelope downstream: inferOne output parses + survives filterByDiff + builds a valid review payload', async () => {
  // 1. Real repo with three changed files, three scanner findings.
  const { root, baseSha, headSha } = makeRepo(
    {
      'svc/a.py': 'def f():\n    pass\n',
      'svc/b.py': 'def g():\n    pass\n',
      'svc/c.py': 'def h():\n    pass\n',
    },
    {
      'svc/a.py': 'def f():\n    pass\n    log.info("A")\n',
      'svc/b.py': 'def g():\n    pass\n    log.info("B")\n',
      'svc/c.py': 'def h():\n    pass\n    log.info("C")\n',
    },
  );
  const reportPath = join(root, 'report.json');
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: ['svc/a.py', 'svc/b.py', 'svc/c.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'svc/a.py',
          line: 1,
          confidence: 0.95,
          why_it_matters: 'finding A — load-bearing message ≥ 10 chars',
          references: [{ url: 'https://example.com/a' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
        {
          category: 'B',
          file: 'svc/b.py',
          line: 1,
          confidence: 0.9,
          why_it_matters: 'finding B — also load-bearing message',
          references: [{ url: 'https://example.com/b' }],
          diff: { before_lines: [{ line_number: 1, code: 'def g():', kind: 'del' }] },
        },
        {
          category: 'C',
          file: 'svc/c.py',
          line: 1,
          confidence: 0.85,
          why_it_matters: 'finding C — also load-bearing message',
          references: [{ url: 'https://example.com/c' }],
          diff: { before_lines: [{ line_number: 1, code: 'def h():', kind: 'del' }] },
        },
      ],
    },
  } as unknown as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));
  const outPath = join(root, 'envelope.json');

  try {
    // 2. Run inferOne THREE times against a stub model — exactly as
    // the bash for-loop in action.yml would.
    const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
      // Echo the focal file:line from the prompt → suggestion at
      // a `+` line (line 3 = the added log.info). Real GitHub
      // Models would do the same anchoring.
      const m = args.user.match(/svc\/([abc])\.py:/);
      const tag = m ? m[1] : 'x';
      return JSON.stringify({
        suggestions: [
          {
            file: `svc/${tag}.py`,
            line: 3,
            category: tag === 'a' ? 'A' : tag === 'b' ? 'B' : 'C',
            confidence: 0.9,
            why_it_matters: `model-generated rationale for ${tag} — ≥ 10 chars`,
            references: [{ url: `https://example.com/fix-${tag}` }],
            after_code: `    log.info("FIXED_${tag}")`,
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
    for (let i = 0; i < 3; i += 1) {
      await inferOne({ ...baseDeps, idx: i });
    }

    // 3. The envelope ai-infer-one wrote is the EXACT input the
    // post bundle reads from disk. Run it through the SAME parser
    // ai-index.ts uses → assert the round-trip is lossless.
    const rawEnvelope = readFileSync(outPath, 'utf8');
    const parsed = parseAIOutput(rawEnvelope);
    assert.ok(parsed.ok, `parse must succeed; got: ${!parsed.ok ? parsed.reason : '?'}`);
    assert.equal(parsed.suggestions.length, 3);
    assert.equal(parsed.passing, 3, 'all 3 must clear the quality bar');
    assert.equal(parsed.total, 3);

    // 4. filterByDiff against the REAL PR diff (line 3 is the only
    // `+` line in each file, which matches what the stub returned).
    const commentable = new Map<string, Set<number>>([
      ['svc/a.py', new Set([3])],
      ['svc/b.py', new Set([3])],
      ['svc/c.py', new Set([3])],
    ]);
    const { kept, dropped } = filterByDiff(parsed.suggestions, commentable);
    assert.equal(kept.length, 3, 'all 3 anchored to a `+` line');
    assert.equal(dropped.length, 0);

    // 5. buildReviewComments → the payload pulls.createReview expects.
    const comments = buildReviewComments(kept, 'openai/gpt-4o');
    assert.equal(comments.length, 3);
    for (const c of comments) {
      assert.equal(c.side, 'RIGHT', 'all anchors on the RIGHT side (new file)');
      assert.match(c.body, /```suggestion/);
      assert.match(c.path, /^svc\/[abc]\.py$/);
      assert.equal(c.line, 3);
    }
    // Each file's after_code lands inside its own ```suggestion``` block —
    // proves the suggestion bodies aren't shuffled across files.
    const aBody = comments.find((c) => c.path === 'svc/a.py')!.body;
    assert.match(aBody, /FIXED_a/);
    assert.ok(!aBody.includes('FIXED_b') && !aBody.includes('FIXED_c'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('envelope downstream: a partially-anchorable envelope drops the off-diff entries cleanly', async () => {
  // inferOne happily appends suggestions for findings whose file is
  // on the diff; the post layer is the SECOND filter — anchored at
  // line-level instead of file-level. This test simulates "model
  // returned `line: 7` but the diff only has `+` at line 3" — the
  // post layer must drop, not 422.
  const envelopePath = join(mkdtempSync(join(tmpdir(), 'drift-down2-')), 'env.json');
  writeFileSync(envelopePath, JSON.stringify({
    suggestions: [
      {
        file: 'svc/a.py', line: 3, category: 'A', confidence: 0.9,
        why_it_matters: 'on-diff finding, will survive filterByDiff',
        references: [{ url: 'https://example.com/a' }],
        after_code: '    log.info("KEPT")',
      },
      {
        file: 'svc/b.py', line: 99, category: 'B', confidence: 0.9,
        why_it_matters: 'off-diff finding, must be DROPPED before posting',
        references: [{ url: 'https://example.com/b' }],
        after_code: '    log.info("DROPPED")',
      },
    ],
  }));
  try {
    const parsed = parseAIOutput(readFileSync(envelopePath, 'utf8'));
    assert.ok(parsed.ok);
    const commentable = new Map<string, Set<number>>([
      ['svc/a.py', new Set([3])],
      ['svc/b.py', new Set([5, 6])], // line 99 NOT here
    ]);
    const { kept, dropped } = filterByDiff(parsed.suggestions, commentable);
    assert.deepEqual(kept.map((s) => s.file), ['svc/a.py']);
    assert.deepEqual(dropped.map((s) => `${s.file}:${s.line}`), ['svc/b.py:99']);
    // The dropped entry NEVER reaches buildReviewComments — proves
    // a stale model response can't take the whole review down via 422.
    const comments = buildReviewComments(kept, 'openai/gpt-4o');
    assert.equal(comments.length, 1);
    assert.equal(comments[0].path, 'svc/a.py');
  } finally {
    rmSync(dirname(envelopePath), { recursive: true, force: true });
  }
});

test('envelope downstream: malformed envelope (truncated JSON) → parse rejects with a reason', () => {
  // A subprocess crash mid-write could leave a partial envelope.
  // The downstream layer MUST reject cleanly with a reason — never
  // crash the post step or post garbage.
  const partial = '{"suggestions":[{"file":"a.py","line":3,"categor';
  const parsed = parseAIOutput(partial);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.ok === false && parsed.reason.length > 0);
});

// ── The exact failure mode from the user's PR log ──────────────────────

test('regression: 3 dead-code findings (the actual PR log scenario) flow end-to-end', async () => {
  // Reproduces the user's broken PR pipeline EXACTLY:
  //   Run # Fresh envelope; each iteration appends one suggestion (if any).
  //   🔁 3 of 3 scanner finding(s) → one inference call each
  //   ──── inference 1/3 ──── focal #1: no anchorable focal point at this index — skipping.
  //   ──── inference 2/3 ──── focal #2: no anchorable focal point at this index — skipping.
  //   ──── inference 3/3 ──── focal #3: no anchorable focal point at this index — skipping.
  //   ✅ loop done — 0 suggestion(s) cleared the bar
  // The scanner anchored at function `def` lines (1/8/14), but the PR's
  // `+` lines are INSIDE the function bodies, not at `def`. The old
  // exact-line filter dropped all 3. With the file-level filter +
  // suffix-match on BOTH layers, all 3 should now anchor + post.
  const { root, baseSha, headSha } = makeRepo(
    {
      'app/db.py': 'def get_session():\n    yield None\n',
      'app/repos.py': 'class OrderRepository:\n    def find_by_id(self, id):\n        return None\n',
    },
    {
      'app/db.py': 'def get_session():\n    yield None\n    log.info("session created")\n',
      'app/repos.py': 'class OrderRepository:\n    def find_by_id(self, id):\n        return None\n    def find_all(self):\n        return []\n',
    },
  );
  const reportPath = join(root, 'report.json');
  // EXACTLY the shape from action/.dev/report.json — 3 dead-code
  // findings, scanner-anchored at the `def`/`<module>` lines (1, 1, 2)
  // which are NOT the `+` lines in the diff. before_lines is populated.
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.1' },
    pr_scope: {
      changed_files: ['app/db.py', 'app/repos.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'app/db.py',
          line: 1, // anchored at the `def` line; PR's `+` is line 3
          confidence: 1.0,
          why_it_matters: 'dead-code: <module> in app/db.py is reachable by zero callers',
          references: [{ url: 'https://example.com/dead-code' }],
          diff: { before_lines: [{ line_number: 1, code: 'def get_session():', kind: 'del' }] },
        },
        {
          category: 'A',
          file: 'app/db.py',
          line: 1, // SAME file, SAME line — scanner can emit duplicates
          confidence: 0.95,
          why_it_matters: 'dead-code: get_session in app/db.py is reachable by zero callers',
          references: [{ url: 'https://example.com/dead-code-2' }],
          diff: { before_lines: [{ line_number: 1, code: 'def get_session():', kind: 'del' }] },
        },
        {
          category: 'A',
          file: 'app/repos.py',
          line: 2, // anchored at `def find_by_id`; PR's `+` is line 4 or 5
          confidence: 0.9,
          why_it_matters: 'dead-code: OrderRepository::find_by_id reachable by zero callers',
          references: [{ url: 'https://example.com/dead-code-3' }],
          diff: { before_lines: [{ line_number: 2, code: '    def find_by_id(self, id):', kind: 'del' }] },
        },
      ],
    },
  } as unknown as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));
  const outPath = join(root, 'envelope.json');

  const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
    // Pretend the model correctly anchored to a `+` line — for db.py
    // that's line 3 (the new log.info), for repos.py it's line 4 or 5.
    const isDb = /app\/db\.py/.test(args.user);
    const file = isDb ? 'app/db.py' : 'app/repos.py';
    const line = isDb ? 3 : 5;
    return JSON.stringify({
      suggestions: [
        {
          file,
          line,
          category: 'A',
          confidence: 0.85,
          why_it_matters: `model-anchored fix for ${file} dead-code finding`,
          references: [{ url: 'https://example.com/fix' }],
          after_code: '    # remove this dead code',
        },
      ],
    });
  };
  const { logger, messages } = captureLogger();
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
    // ── ai-infer-one phase: 3 iterations (the bash loop) ──────────────
    for (let i = 0; i < 3; i += 1) {
      await inferOne({ ...baseDeps, idx: i });
    }

    // CRITICAL: under the OLD exact-line filter the envelope would be
    // empty. Under the new file-level filter, all 3 should reach the
    // model + 3 suggestions land.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 3, `envelope must have 3 suggestions; got ${env.suggestions.length}`);

    // The log MUST name the cohort breadcrumb for each focal point —
    // surfaces what the user can grep for in the PR run log.
    const log = messages.join('\n');
    assert.match(log, /focal #1: app\/db\.py:1.*cohort 3\/3 anchorable/);
    assert.match(log, /focal #1: \+1 suggestion → app\/db\.py:3/);
    assert.match(log, /focal #3: app\/repos\.py:2.*cohort 3\/3 anchorable/);

    // ── ai-suggest phase: parse + filterByDiff + buildReviewComments ──
    const parsed = parseAIOutput(readFileSync(outPath, 'utf8'));
    assert.ok(parsed.ok);
    assert.equal(parsed.suggestions.length, 3);

    // GitHub's listFiles returns the same paths as the scanner here.
    const commentable = new Map<string, Set<number>>([
      ['app/db.py', new Set([3])],          // line 3 = the `+ log.info`
      ['app/repos.py', new Set([4, 5])],    // lines 4-5 = the `+ def find_all`
    ]);
    const { kept, dropped, reasons: _reasons } = filterByDiff(parsed.suggestions, commentable);
    assert.equal(kept.length, 3, 'every model-anchored suggestion is on a `+` line');
    assert.equal(dropped.length, 0);

    const comments = buildReviewComments(kept, 'openai/gpt-4o');
    assert.equal(comments.length, 3);
    assert.deepEqual(
      comments.map((c) => `${c.path}:${c.line}`).sort(),
      ['app/db.py:3', 'app/db.py:3', 'app/repos.py:5'].sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('regression: real production scanner report (action/.dev/report.json) survives the post-pipeline', async () => {
  // Load the ACTUAL scanner output sitting in action/.dev/report.json
  // — captured from a real scan, NOT hand-written. If the scanner
  // emits a shape this codebase doesn't understand, this test fails
  // long before a consumer's PR does.
  const here = dirname(new URL(import.meta.url).pathname);
  const fixturePath = join(here, '..', '..', '.dev', 'report.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const suggestions = fixture.pr_review?.code_suggestions;
  assert.ok(Array.isArray(suggestions), 'real fixture must carry code_suggestions');
  assert.ok(suggestions.length > 0, 'real fixture must have ≥ 1 finding');

  // Build an envelope as if the MODEL had echoed the focal-file path
  // verbatim and anchored each finding to a believable `+` line
  // (focal_line + 3, the same offset a `def` → function-body anchor
  // would land at). This is what the per-suggestion loop produces.
  const envelope = {
    suggestions: suggestions.map((s: { file: string; line: number; category: string }) => ({
      file: s.file,
      line: s.line + 3,
      category: s.category,
      confidence: 0.85,
      why_it_matters: 'derived from a real-scanner finding (fixture-driven)',
      references: [{ url: 'https://example.com/fix' }],
      after_code: '    # remediation',
    })),
  };
  const parsed = parseAIOutput(JSON.stringify(envelope));
  assert.ok(parsed.ok, 'real-fixture envelope must parse cleanly');
  assert.equal(parsed.suggestions.length, suggestions.length);

  // Simulate GitHub's pulls.listFiles response — keys are the EXACT
  // scanner paths (no monorepo split), with a wide commentable range
  // covering every focal_line + 3. filterByDiff should keep all of
  // them; if any get dropped, the production pipeline is broken too.
  const commentable = new Map<string, Set<number>>();
  for (const s of suggestions as { file: string; line: number }[]) {
    const set = commentable.get(s.file) ?? new Set<number>();
    set.add(s.line + 3);
    commentable.set(s.file, set);
  }
  const { kept, dropped, reasons } = filterByDiff(parsed.suggestions, commentable);
  assert.equal(
    dropped.length, 0,
    `real-fixture suggestions must ALL survive filterByDiff; reasons=${JSON.stringify(reasons)}`,
  );
  assert.equal(kept.length, suggestions.length);

  // buildReviewComments shapes them for createReview — no field is
  // missing on a real-scanner-shaped finding.
  const comments = buildReviewComments(kept, 'openai/gpt-4o');
  assert.equal(comments.length, suggestions.length);
  for (const c of comments) {
    assert.equal(c.side, 'RIGHT');
    assert.match(c.body, /```suggestion/);
    assert.ok(c.path.length > 0);
    assert.ok(typeof c.line === 'number' && c.line >= 1);
  }
});

test('regression: scanner uses DEEPER path than GitHub diff → BOTH filter layers bridge it', async () => {
  // Defense-in-depth: the second filter (filterByDiff in ai-index.ts)
  // also had to learn suffix-match — without it, even if ai-infer-one
  // wrote a suggestion successfully, ai-suggest would drop it on the
  // way out because the model echoed the scanner's path (deeper than
  // GitHub's normalized path). This proves both layers now agree.
  const { root, baseSha, headSha } = makeRepo(
    { 'svc/a.py': 'def f():\n    pass\n' },
    { 'svc/a.py': 'def f():\n    pass\n    log.info("ADDED")\n' },
  );
  const reportPath = join(root, 'report.json');
  // Scanner emits a path with a deeper prefix than git diff sees.
  // (Real scenario: monorepo where the scanner is rooted at a sub-crate.)
  const scannerPath = 'crate-monorepo/services/svc/a.py';
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: ['svc/a.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: scannerPath, // ← deeper than git diff's `svc/a.py`
          line: 1,
          confidence: 0.9,
          why_it_matters: 'finding with deeper-than-diff path',
          references: [{ url: 'https://example.com/x' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
      ],
    },
  }));
  const outPath = join(root, 'envelope.json');

  // Stub model echoes the scanner path verbatim, anchors to line 3.
  const callModel: NonNullable<InferOneDeps['callModel']> = async () =>
    JSON.stringify({
      suggestions: [{
        file: scannerPath,
        line: 3,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'fix uses the deeper scanner path verbatim',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    pass',
      }],
    });
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
      callModel,
      logger,
    });
    // Layer 1 passed → envelope has the suggestion.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1, 'inferOne layer must bridge path-base via lookupCommentable');

    // Layer 2 (ai-suggest) — GitHub's listFiles returns `svc/a.py` (the
    // shallower path) while the suggestion has the deeper scanner path.
    // Without suffix-match in filterByDiff this would drop silently.
    const parsed = parseAIOutput(readFileSync(outPath, 'utf8'));
    assert.ok(parsed.ok);
    const commentable = new Map<string, Set<number>>([['svc/a.py', new Set([3])]]);
    const { kept, dropped } = filterByDiff(parsed.suggestions, commentable);
    assert.equal(kept.length, 1, 'filterByDiff layer must ALSO bridge path-base');
    assert.equal(dropped.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── Full ai-index chain: spy octokit handles BOTH listFiles + createReview ─

test('full ai-index chain: envelope + spy Octokit → exact createReview payload + correct cap', async () => {
  // Mirrors aiMain() in ai-index.ts step for step against a spy
  // Octokit that handles BOTH listFiles (read) AND createReview
  // (write). Catches WIRING breakage (envelope writer/reader
  // contract drift, filter-then-cap order, createReview payload
  // shape) even when each unit test passes.
  const { fetchCommentableLines, postAIReview } = await import('../ai/post.ts');

  const root = mkdtempSync(join(tmpdir(), 'drift-aindex-'));
  const envPath = join(root, 'env.json');
  writeFileSync(envPath, JSON.stringify({
    suggestions: [
      {
        file: 'svc/a.py', line: 12, category: 'A', confidence: 0.95,
        why_it_matters: 'high-priority finding — on-diff, ≥10 chars',
        references: [{ url: 'https://example.com/a' }],
        after_code: '    log.info("FIXED_A")',
      },
      {
        file: 'svc/b.py', line: 8, category: 'B', confidence: 0.92,
        why_it_matters: 'second finding — also on-diff, ≥10 chars',
        references: [{ url: 'https://example.com/b' }],
        after_code: '    log.info("FIXED_B")',
      },
      {
        file: 'svc/c.py', line: 999, category: 'C', confidence: 0.91,
        why_it_matters: 'third finding — off-diff, MUST be dropped',
        references: [{ url: 'https://example.com/c' }],
        after_code: '    log.info("FIXED_C")',
      },
      {
        file: 'svc/d.py', line: 3, category: 'A', confidence: 0.90,
        why_it_matters: 'fourth finding — on-diff but past the cap',
        references: [{ url: 'https://example.com/d' }],
        after_code: '    log.info("FIXED_D")',
      },
    ],
  }));

  const calls: Array<{ method: string; args: unknown }> = [];
  const spyOctokit = {
    rest: {
      pulls: {
        listFiles: async (args: unknown) => {
          calls.push({ method: 'pulls.listFiles', args });
          return {
            data: [
              { filename: 'svc/a.py', patch: '@@ -11,1 +11,2 @@\n existing\n+anchor at line 12' },
              { filename: 'svc/b.py', patch: '@@ -7,1 +7,2 @@\n existing\n+anchor at line 8' },
              { filename: 'svc/d.py', patch: '@@ -2,1 +2,2 @@\n existing\n+anchor at line 3' },
              // svc/c.py NOT in the diff → its line-999 suggestion drops.
            ],
          };
        },
        createReview: async (args: unknown) => {
          calls.push({ method: 'pulls.createReview', args });
          return { data: { id: 99 } };
        },
      },
    },
  };

  try {
    // 1. Parse the envelope ai-infer-one wrote.
    const parsed = parseAIOutput(readFileSync(envPath, 'utf8'));
    assert.ok(parsed.ok);
    assert.equal(parsed.suggestions.length, 4);

    // 2. Fetch commentable lines (octokit call #1).
    const map = await fetchCommentableLines(
      spyOctokit as unknown as Parameters<typeof fetchCommentableLines>[0],
      'acme', 'shop', 77,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'pulls.listFiles');
    assert.deepEqual(calls[0].args, {
      owner: 'acme', repo: 'shop', pull_number: 77, per_page: 100,
    });
    assert.equal(map.size, 3);
    assert.ok(!map.has('svc/c.py'));

    // 3. Filter by diff — off-diff drops here.
    const { kept, dropped } = filterByDiff(parsed.suggestions, map);
    assert.equal(kept.length, 3);
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0].file, 'svc/c.py');

    // 4. Cap AFTER filter (filter-then-cap is the documented order).
    const MAX = 2;
    const toPost = kept.slice(0, MAX);
    assert.deepEqual(toPost.map((s) => s.file), ['svc/a.py', 'svc/b.py']);

    // 5. postAIReview (octokit call #2).
    const result = await postAIReview({
      octokit: spyOctokit as unknown as Parameters<typeof postAIReview>[0]['octokit'],
      owner: 'acme', repo: 'shop', prNumber: 77,
      headSha: 'deadbeefcafe1234567890abcdef0123456789ab',
      suggestions: toPost,
      model: 'openai/gpt-4o',
    });
    assert.equal(result.posted, true);
    assert.equal(result.commentCount, 2);

    // 6. Assert the exact createReview payload (per GitHub REST docs).
    assert.equal(calls.length, 2);
    assert.equal(calls[1].method, 'pulls.createReview');
    const review = calls[1].args as Record<string, unknown>;
    assert.equal(review.owner, 'acme');
    assert.equal(review.repo, 'shop');
    assert.equal(review.pull_number, 77);
    assert.equal(review.commit_id, 'deadbeefcafe1234567890abcdef0123456789ab');
    assert.equal(review.event, 'COMMENT');
    assert.match(review.body as string, /openai\/gpt-4o/);
    const reviewComments = review.comments as Array<Record<string, unknown>>;
    assert.equal(reviewComments.length, 2);
    assert.deepEqual(
      reviewComments.map((c) => `${c.path}:${c.line}`),
      ['svc/a.py:12', 'svc/b.py:8'],
    );
    for (const c of reviewComments) {
      assert.equal(c.side, 'RIGHT');
      assert.match(c.body as string, /```suggestion/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('full ai-index chain: zero anchorable suggestions → NO createReview call (silence > noise)', async () => {
  // aiMain short-circuits when toPost.length === 0. Pin that
  // contract: a spy that records ANY createReview call here would
  // catch the regression.
  const { fetchCommentableLines } = await import('../ai/post.ts');

  const root = mkdtempSync(join(tmpdir(), 'drift-aindex-zero-'));
  const envPath = join(root, 'env.json');
  writeFileSync(envPath, JSON.stringify({
    suggestions: [
      {
        file: 'svc/a.py', line: 99, category: 'A', confidence: 0.95,
        why_it_matters: 'finding is off-diff, ≥10 chars',
        references: [{ url: 'https://example.com/x' }],
        after_code: 'fix',
      },
    ],
  }));

  let createReviewCalls = 0;
  const spy = {
    rest: {
      pulls: {
        listFiles: async () => ({
          data: [{ filename: 'svc/a.py', patch: '@@ -1,1 +1,2 @@\n a\n+b' }],
        }),
        createReview: async () => {
          createReviewCalls += 1;
          return { data: { id: 1 } };
        },
      },
    },
  };

  try {
    const parsed = parseAIOutput(readFileSync(envPath, 'utf8'));
    assert.ok(parsed.ok);
    const map = await fetchCommentableLines(
      spy as unknown as Parameters<typeof fetchCommentableLines>[0],
      'acme', 'shop', 1,
    );
    const { kept } = filterByDiff(parsed.suggestions, map);
    // line 99 is not in the +1,+2 hunk → dropped.
    assert.equal(kept.length, 0);
    // aiMain would short-circuit here. NO createReview call.
    assert.equal(createReviewCalls, 0, 'an empty toPost MUST NOT hit pulls.createReview');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
