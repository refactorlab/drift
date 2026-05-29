// Tests for the AI context builder (src/ai/build-context.ts).
//
// Key assertions:
//   1. When the scanner emits code_suggestions, they drive the context
//      as "Focal points" — file:line + function + scanner metadata.
//   2. Focal-point ordering is by descending confidence.
//   3. The PR diff is filtered to focal files first, padded with
//      other changed files up to maxFiles.
//   4. Falls back gracefully to diff-only when code_suggestions empty.
//   5. Byte-budget cap is enforced.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAIContext } from '../ai/build-context.ts';
import type { ScanPrOutput } from '../report.ts';

function makeFakeRepo(report: ScanPrOutput | null, files: Record<string, string>): {
  root: string;
  baseSha: string;
  headSha: string;
  reportPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'drift-ctx-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: root });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path);
    const dir = abs.slice(0, abs.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(abs, content);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  const reportPath = join(root, 'report.json');
  if (report) writeFileSync(reportPath, JSON.stringify(report));

  return { root, baseSha, headSha, reportPath };
}

function minimalReportWithSuggestions(): ScanPrOutput {
  return {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0' },
    pr_scope: {
      changed_files: ['src/payments/retry.py', 'src/users/service.py'],
      affected_roots: ['process_payment'],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          category_label: 'Optimization — N+1',
          file: 'src/users/service.py',
          function: 'dashboard',
          line: 3,
          confidence: 0.6,
          why_it_matters: 'N+1 query in dashboard.',
          references: [{ url: 'https://docs.sqlalchemy.org/selectinload' }],
          // Scanner-side extension fields:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({
            rule_id: 'S1:n-plus-one',
            remediation_hint: 'Use selectinload',
            llm_prompt_hint: 'Suggest selectinload-based fix; cite SQLA docs.',
          } as any),
        },
        {
          category: 'B',
          category_label: 'Product correctness — silent failure',
          file: 'src/payments/retry.py',
          function: 'process_payment',
          line: 2,
          confidence: 0.95,
          why_it_matters: 'Silent failure swallows GatewayTimeoutError.',
          references: [{ url: 'https://docs.python.org/3/library/exceptions.html' }],
        },
      ],
    },
  };
}

test('buildAIContext: focal points emitted in confidence-descending order', () => {
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(
    minimalReportWithSuggestions(),
    {
      'src/payments/retry.py':
        'def process_payment(req):\n    try:\n        return charge(req)\n    except Exception:\n        pass\n',
      'src/users/service.py':
        'def dashboard():\n    users = db.users.all()\n    return [{ "u": u, "orders": u.orders } for u in users]\n',
    },
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
    assert.equal(ctx.focalPoints, 2);
    assert.equal(ctx.source, 'focal+diff');

    const retryIdx = ctx.text.indexOf('src/payments/retry.py');
    const dashIdx = ctx.text.indexOf('src/users/service.py');
    assert.ok(retryIdx > -1 && dashIdx > -1);
    assert.ok(
      retryIdx < dashIdx,
      'higher-confidence suggestion (0.95) must come before lower (0.6)',
    );

    // Focal-point metadata is surfaced.
    assert.ok(ctx.text.includes('rule_id: S1:n-plus-one'));
    assert.ok(ctx.text.includes('remediation_hint: Use selectinload'));
    assert.ok(ctx.text.includes('llm_prompt_hint:'));
    assert.ok(ctx.text.includes('function `dashboard`'));
    assert.ok(ctx.text.includes('function `process_payment`'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderScannerCodeWindow: marks the kind=del row with ← and pads line numbers', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const s = {
    file: 'src/repo.kt',
    line: 17,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [
        { line_number: 14, code: '', kind: 'ctx' as const },
        { line_number: 15, code: '    fun save(order: Order): Long {', kind: 'ctx' as const },
        { line_number: 16, code: '        val stmt = conn.prepareStatement(', kind: 'ctx' as const },
        { line_number: 17, code: '            "INSERT INTO orders ... " +', kind: 'del' as const },
        { line_number: 18, code: '                "VALUES (?, ?, ?)",', kind: 'ctx' as const },
        { line_number: 19, code: '            Statement.RETURN_GENERATED_KEYS,', kind: 'ctx' as const },
        { line_number: 20, code: '        )', kind: 'ctx' as const },
      ],
    },
  };
  const out = renderScannerCodeWindow(s);
  assert.ok(out, 'expected a rendered window');
  // Focal line carries the ← marker right after the line-number column.
  assert.match(out!, /^17│←/m);
  // Non-focal rows start with `<num>│ ` (single-space marker, NOT `←`).
  assert.match(out!, /^15│ {2}    fun save/m);
  assert.match(out!, /^20│ {2}        \)$/m);
});

test('renderScannerCodeWindow: no del row → falls back to s.line, then to middle', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const base = {
    file: 'a.py',
    line: 42,
    category: 'A' as const,
    confidence: 0.9,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
  };

  // Match by line_number when no `del` row.
  const matchByLine = renderScannerCodeWindow({
    ...base,
    diff: {
      before_lines: [
        { line_number: 41, code: 'a', kind: 'ctx' as const },
        { line_number: 42, code: 'b', kind: 'ctx' as const },
        { line_number: 43, code: 'c', kind: 'ctx' as const },
      ],
    },
  });
  assert.match(matchByLine!, /42│← b/);

  // Fall back to middle row when neither `del` nor a matching line_number.
  const middle = renderScannerCodeWindow({
    ...base,
    line: 999,
    diff: {
      before_lines: [
        { line_number: 1, code: 'a', kind: 'ctx' as const },
        { line_number: 2, code: 'b', kind: 'ctx' as const },
        { line_number: 3, code: 'c', kind: 'ctx' as const },
      ],
    },
  });
  assert.match(middle!, /2│← b/);
});

test('renderScannerCodeWindow: missing/sparse line_number → blank prefix, no crash', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 5,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [
        { code: 'no-line-number-row', kind: 'ctx' as const },
        { line_number: 5, code: 'focal', kind: 'del' as const },
      ],
    },
  });
  assert.ok(out);
  // The first row has no line_number → its column is whitespace.
  assert.match(out!, /^ +│ {2}no-line-number-row\n5│← focal$/);
});

test('renderScannerCodeWindow: empty / missing before_lines → null', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const base = {
    file: 'a.py',
    line: 1,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
  };
  assert.equal(renderScannerCodeWindow(base), null);
  assert.equal(renderScannerCodeWindow({ ...base, diff: { before_lines: [] } }), null);
});

test('renderScannerCodeWindow: single-row window renders without crashing', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 5,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: { before_lines: [{ line_number: 5, code: 'only', kind: 'del' as const }] },
  });
  // Single row IS the focal row.
  assert.equal(out, '5│← only');
});

test('renderScannerCodeWindow: multiple del rows → the FIRST wins (deterministic)', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 0,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [
        { line_number: 1, code: 'a', kind: 'del' as const },
        { line_number: 2, code: 'b', kind: 'del' as const },
        { line_number: 3, code: 'c', kind: 'ctx' as const },
      ],
    },
  });
  assert.match(out!, /^1│← a$/m);
  // The second del row is NOT marked focal (deterministic single anchor).
  assert.match(out!, /^2│ {2}b$/m);
});

test('renderScannerCodeWindow: negative / zero line_numbers render as blank prefix', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 100,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [
        { line_number: -1, code: 'bad-1', kind: 'ctx' as const },
        { line_number: 0, code: 'bad-2', kind: 'ctx' as const },
        { line_number: 100, code: 'focal', kind: 'del' as const },
      ],
    },
  });
  // Pad width is set by 100 → 3. Negative/zero rows blank-out the column.
  assert.ok(out);
  assert.match(out!, /^ {3}│ {2}bad-1$/m);
  assert.match(out!, /^ {3}│ {2}bad-2$/m);
  assert.match(out!, /^100│← focal$/m);
});

test('renderScannerCodeWindow: embedded \\n in code is replaced with ⏎ (alignment safety)', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 1,
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [{ line_number: 1, code: 'two\nlines\rwith\r\nbreaks', kind: 'del' as const }],
    },
  });
  assert.equal(out, '1│← two⏎lines⏎with⏎breaks');
  // No actual newline character ever escapes the renderer.
  assert.ok(!out!.includes('\n'));
});

test('renderScannerCodeWindow: all-sparse line_numbers → focal falls back to middle row', async () => {
  const { renderScannerCodeWindow } = await import('../ai/build-context.ts');
  const out = renderScannerCodeWindow({
    file: 'a.py',
    line: 999, // doesn't match any row
    category: 'B' as const,
    confidence: 0.8,
    why_it_matters: 'x',
    references: [{ url: 'https://example.com/x' }],
    diff: {
      before_lines: [
        { code: 'r1', kind: 'ctx' as const },
        { code: 'r2', kind: 'ctx' as const },
        { code: 'r3', kind: 'ctx' as const },
      ],
    },
  });
  // No `del`, no matching `line_number` → middle row (index 1).
  assert.ok(out);
  assert.match(out!, /^ │← r2$/m);
});

test('prompt snapshot: full focal user prompt structure (ordered sections, scanner-grounded)', async () => {
  // Hard-pins the SHAPE of the prompt the model receives: every named
  // section appears, in the right order, with the right content
  // sourced from the scanner JSON. If a future refactor drops the
  // rule_id, the remediation_hint, the references list, the scanner
  // window, OR the numbered diff section — this test fails.
  const { buildFocalUserPrompt } = await import('../ai/focal-prompt.ts');
  const { root, baseSha } = makeFakeRepo(null, {
    'svc/x.py': 'def f():\n    pass\n    log.info("ADDED")\n',
  });
  try {
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();

    const report: ScanPrOutput = {
      schema_version: '1.0',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: ['svc/x.py'], affected_roots: [], unreachable_changes: [] },
      pr_review: {
        code_suggestions: [
          {
            category: 'B',
            category_label: 'Product correctness — Auth',
            file: 'svc/x.py',
            function: 'f',
            line: 1,
            confidence: 0.92,
            why_it_matters: 'flagged — function f is dead in a changed file',
            references: [
              { url: 'https://example.com/dead-code', title: 'Dead-code reasoning' },
              { url: 'https://example.com/owasp', title: 'OWASP A01' },
            ],
            diff: {
              before_lines: [
                { line_number: 1, code: 'def f():', kind: 'del' },
                { line_number: 2, code: '    pass', kind: 'ctx' },
              ],
            },
            ...({
              rule_id: 'S2:dead-code',
              remediation_hint: 'Remove or wire it up.',
              llm_prompt_hint: 'Drift flagged this as dead.',
            } as Record<string, unknown>),
          } as unknown as NonNullable<
            NonNullable<ScanPrOutput['pr_review']>['code_suggestions']
          >[number],
        ],
      },
    };

    const prompt = buildFocalUserPrompt(report, 0, {
      workspaceRoot: root,
      baseSha,
      headSha,
    });
    assert.ok(prompt);

    // The header section: ordinal + file:line + function · category +
    // confidence + why + scanner-extension metadata.
    const requiredInOrder = [
      '=== Focal point (1 scanner-flagged location) ===',
      '[1] svc/x.py:1 · function `f`',
      '    category: B — Product correctness — Auth',
      '    scanner_confidence: 0.92',
      '    why: flagged — function f is dead in a changed file',
      '    rule_id: S2:dead-code',
      '    remediation_hint: Remove or wire it up.',
      '    llm_prompt_hint: Drift flagged this as dead.',
      '    references:',
      '      - Dead-code reasoning <https://example.com/dead-code>',
      '      - OWASP A01 <https://example.com/owasp>',
      '    code window (scanner ±3, focal marked ←):',
      '      1│← def f():',
      '      2│      pass',
      '=== PR diff for svc/x.py ',
      '### svc/x.py',
    ];
    let cursor = 0;
    for (const needle of requiredInOrder) {
      const at = prompt!.indexOf(needle, cursor);
      assert.ok(
        at >= 0,
        `prompt missing expected section in order: ${JSON.stringify(needle)}\n` +
          `cursor was ${cursor}\n` +
          `prompt so far:\n${prompt!.slice(cursor, cursor + 400)}`,
      );
      cursor = at + needle.length;
    }

    // The diff section MUST be numbered with new-side line numbers and
    // mark `+` lines explicitly (the only commentable surface for the
    // model to anchor to). With no base content, every line is added.
    assert.match(prompt!, /^\s*1 \+def f\(\):/m);
    assert.match(prompt!, /^\s*2 \+ +pass/m);
    assert.match(prompt!, /^\s*3 \+ +log\.info\("ADDED"\)/m);

    // Negative invariants: nothing references the disk-fallback path
    // and nothing references the OLD strict-line filter outcome.
    assert.ok(!prompt!.includes('code window (HEAD'));
    assert.ok(!prompt!.includes('no anchorable focal point'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('end-to-end: buildFocalUserPrompt — scanner window + numbered PR diff survive a real git diff', async () => {
  // Stand up a real one-commit-deep git repo so getFullDiff / getPrDiff
  // actually run. Edit the file so the PR's `+` lines are at line 8 (the
  // CHANGE), while the scanner-flagged focal line is at line 3 (a symbol
  // declaration). This is the load-bearing case for B + file-level
  // filtering: previously the strict line filter dropped this finding
  // silently; now it survives, the scanner window grounds the prompt,
  // and the diff carries the actual `+` line for the model to anchor to.
  const { buildFocalUserPrompt } = await import('../ai/focal-prompt.ts');
  const { root, baseSha, headSha } = makeFakeRepo(null, {
    'svc/repo.py': [
      'def load_user(uid):',         // line 1  (declaration — focal)
      '    """deprecated"""',         // line 2
      '    return None',              // line 3
      '',                              // line 4
      'def loader(uid):',              // line 5
      '    return Q(uid).first()',     // line 6
      '',                              // line 7
      '    log.warn("dropped")',       // line 8 (added below)
      '',
    ].join('\n'),
  });
  try {
    // Stage a SECOND edit so there's a real PR diff at line 8 only.
    writeFileSync(
      join(root, 'svc/repo.py'),
      [
        'def load_user(uid):',         // line 1
        '    """deprecated"""',         // line 2
        '    return None',              // line 3
        '',                              // line 4
        'def loader(uid):',              // line 5
        '    return Q(uid).first()',     // line 6
        '',                              // line 7
        '    log.warn("ADDED IN PR")',   // line 8 ← the diff's `+` line
        '',
      ].join('\n'),
    );
    execFileSync('git', ['commit', '-am', 'add-warn'], { cwd: root });
    const headSha2 = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();

    const report: ScanPrOutput = {
      schema_version: '1.0',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: {
        changed_files: ['svc/repo.py'],
        affected_roots: [],
        unreachable_changes: [],
      },
      pr_review: {
        code_suggestions: [
          {
            category: 'A',
            file: 'svc/repo.py',
            line: 1, // declaration — NOT a `+` line in this PR
            confidence: 0.9,
            why_it_matters: 'load_user is dead code in a file you touched',
            references: [{ url: 'https://example.com/dead-code' }],
            // Scanner's pre-baked window around the declaration:
            diff: {
              before_lines: [
                { line_number: 1, code: 'def load_user(uid):', kind: 'del' },
                { line_number: 2, code: '    """deprecated"""', kind: 'ctx' },
                { line_number: 3, code: '    return None', kind: 'ctx' },
              ],
            },
          } as unknown as NonNullable<NonNullable<ScanPrOutput['pr_review']>['code_suggestions']>[number],
        ],
      },
    };

    // Build the commentable map the same way ai-infer-one.ts does, so
    // we exercise the actual code path consumers run.
    const { getFullDiff, commentableLinesByFile } = await import('../ai/build-context.ts');
    const fullDiff = getFullDiff(root, baseSha, headSha2);
    const commentable = commentableLinesByFile(fullDiff);
    // Sanity: the diff has line 8 (the added warn) — NOT line 1.
    const lines = commentable.get('svc/repo.py')!;
    assert.ok(lines, 'diff should contain svc/repo.py');
    assert.ok(lines.size > 0, 'svc/repo.py should have at least one commentable line');

    const prompt = buildFocalUserPrompt(
      report,
      0,
      { workspaceRoot: root, baseSha, headSha: headSha2 },
      commentable,
    );
    assert.ok(prompt, 'prompt must survive — file-level filter keeps off-exact-line findings');

    // Scanner window grounds the focal section.
    assert.match(prompt!, /code window \(scanner ±3, focal marked ←\):/);
    assert.match(prompt!, /1│← def load_user/);
    assert.match(prompt!, /3│ {2} {4}return None/);

    // PR diff section is present and numbered (the anchor surface for the model).
    assert.match(prompt!, /=== PR diff for svc\/repo\.py /);
    assert.match(prompt!, /\+ {4}log\.warn\("ADDED IN PR"\)/);

    // The disk-read fallback label MUST NOT appear — scanner window won.
    assert.ok(!prompt!.includes('code window (HEAD'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderFocalPoint: prefers scanner window over disk (no disk read needed)', async () => {
  const { renderFocalPoint } = await import('../ai/build-context.ts');
  // workspaceRoot points at a path that doesn't exist — proves the scanner
  // window is used (disk read would return null and produce no window).
  const out = renderFocalPoint(
    {
      file: 'src/x.kt',
      line: 17,
      category: 'B',
      confidence: 0.8,
      why_it_matters: 'sql concat',
      references: [{ url: 'https://example.com/x' }],
      diff: {
        before_lines: [
          { line_number: 16, code: 'before', kind: 'ctx' },
          { line_number: 17, code: 'focal', kind: 'del' },
          { line_number: 18, code: 'after', kind: 'ctx' },
        ],
      },
    },
    1,
    '/nonexistent/workspace/root',
  );
  assert.match(out, /code window \(scanner ±3, focal marked ←\):/);
  assert.match(out, /17│← focal/);
});

test('lookupCommentable: exact key wins; else longest-suffix match', async () => {
  const { lookupCommentable } = await import('../ai/build-context.ts');
  const map = new Map<string, Set<number>>([
    ['app/db.py', new Set([10])],
    ['src/a.ts', new Set([1, 2, 3])],
  ]);
  // Exact match.
  assert.deepEqual([...lookupCommentable(map, 'src/a.ts')!], [1, 2, 3]);
  // Scanner emitted a deeper path; diff is shallow → resolve by suffix.
  assert.deepEqual([...lookupCommentable(map, 'crate/src/a.ts')!], [1, 2, 3]);
  // Scanner emitted shallower than diff → also resolve (k.endsWith(file)).
  const deeperMap = new Map<string, Set<number>>([
    ['fixtures/app/db.py', new Set([42])],
  ]);
  assert.deepEqual([...lookupCommentable(deeperMap, 'app/db.py')!], [42]);
  // No match.
  assert.equal(lookupCommentable(map, 'other/x.go'), undefined);
});

test('buildAIContext: code window includes the flagged line marker', () => {
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(
    minimalReportWithSuggestions(),
    {
      'src/payments/retry.py':
        'def process_payment(req):\n    try:\n        return charge(req)\n    except Exception:\n        pass\n',
      'src/users/service.py':
        'def dashboard():\n    users = db.users.all()\n    return [{ "u": u, "orders": u.orders } for u in users]\n',
    },
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
    // The code window for retry.py line 2 should include line 2 with the ← marker.
    assert.ok(ctx.text.includes('2│←'), `expected line-2 marker in:\n${ctx.text}`);
    // The code window for service.py line 3 should include line 3 with the ← marker.
    assert.ok(ctx.text.includes('3│←'), `expected line-3 marker in:\n${ctx.text}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildAIContext: falls back to diff-only when no code_suggestions', () => {
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(
    {
      schema_version: '1.0',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: ['a.txt'], affected_roots: [], unreachable_changes: [] },
      // no pr_review.code_suggestions
    },
    { 'a.txt': 'hello\n' },
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
    assert.equal(ctx.focalPoints, 0);
    assert.equal(ctx.source, 'diff-fallback');
    assert.ok(ctx.text.includes('=== Scanner pr_scope'));
    assert.ok(ctx.text.includes('=== PR diff'));
    assert.ok(!ctx.text.includes('=== Focal points'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildAIContext: diff is prioritized to focal files', () => {
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(
    minimalReportWithSuggestions(),
    {
      'src/payments/retry.py':
        'def process_payment(req):\n    try:\n        return charge(req)\n    except Exception:\n        pass\n',
      'src/users/service.py':
        'def dashboard():\n    users = db.users.all()\n    return users\n',
      'src/unrelated.py': '# unrelated\nprint("hi")\n',
    },
  );
  try {
    const ctx = buildAIContext({
      reportPath,
      workspaceRoot: root,
      baseSha,
      headSha,
      maxFiles: 2,            // ← only 2 files in diff; focal files MUST win
      maxFocalPoints: 5,
      byteBudget: 80_000,
    });
    // unrelated.py should be SKIPPED because the two focal files exhaust maxFiles.
    const diffIdx = ctx.text.indexOf('=== PR diff');
    const diffSection = ctx.text.slice(diffIdx);
    assert.ok(diffSection.includes('src/payments/retry.py'));
    assert.ok(diffSection.includes('src/users/service.py'));
    assert.ok(!diffSection.includes('src/unrelated.py'), 'unrelated file must NOT be in the (capped) diff');
    assert.equal(ctx.diffFiles, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildAIContext: byte budget cap is enforced', () => {
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(
    minimalReportWithSuggestions(),
    { 'src/payments/retry.py': 'x\n', 'src/users/service.py': 'y\n' },
  );
  try {
    const ctx = buildAIContext({
      reportPath,
      workspaceRoot: root,
      baseSha,
      headSha,
      maxFiles: 5,
      maxFocalPoints: 5,
      byteBudget: 200,
    });
    assert.ok(ctx.bytes <= 200 + '[truncated at 200 bytes]'.length + 4);
    assert.ok(ctx.text.includes('[truncated at 200 bytes]'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildAIContext: maxFocalPoints caps the focal-point list', () => {
  const report = minimalReportWithSuggestions();
  // Stuff 5 suggestions into the report.
  report.pr_review!.code_suggestions = Array.from({ length: 5 }, (_, i) => ({
    category: 'A',
    file: 'src/users/service.py',
    line: 1,
    confidence: 1 - i * 0.1,
    why_it_matters: `entry ${i}`,
    references: [{ url: 'https://example.com' }],
  }));
  const { root, baseSha, headSha, reportPath } = makeFakeRepo(report, {
    'src/users/service.py': 'a\nb\nc\n',
  });
  try {
    const ctx = buildAIContext({
      reportPath,
      workspaceRoot: root,
      baseSha,
      headSha,
      maxFiles: 5,
      maxFocalPoints: 2,    // ← cap
      byteBudget: 80_000,
    });
    assert.equal(ctx.focalPoints, 2);
    // The two highest-confidence (1.0 and 0.9) should be the survivors.
    assert.ok(ctx.text.includes('entry 0'));
    assert.ok(ctx.text.includes('entry 1'));
    assert.ok(!ctx.text.includes('entry 4'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
