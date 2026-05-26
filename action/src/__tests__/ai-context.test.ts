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
