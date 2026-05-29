// REAL-scanner E2E. Invokes the actual `drift-static-profiler` binary
// against a fixture-cloned git repo and feeds the produced report
// through `inferOne`. Skipped when the binary isn't on disk so CI
// stays green on machines that don't ship the Rust toolchain — the
// goal here is to bracket the scanner→TS contract on the developer
// box, where the binary IS available.
//
// What this proves:
//   1. The scanner produces a report whose `file` / `line` / `kind` /
//      `before_lines` shape our TS understands. If the Rust side
//      breaks the contract, this test fails on the deserialization
//      path long before anything ships.
//   2. The file-level commentable filter survives whatever path
//      format the scanner emits in production (the documented worry
//      from earlier in the diagnosis).
//   3. The scanner-window code path actually receives populated
//      `before_lines` from a real scan (the Kotlin fixture in
//      action/.dev/ already exercises this; here we re-derive it
//      from a fresh scan to catch a future regression).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import { loadReport } from '../report.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const scannerBin = resolve(repoRoot, 'drift-static-profiler/target/release/drift-static-profiler');
const fixture = resolve(repoRoot, 'drift-static-profiler/tests/fixtures/kotlin-ktor');

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

test('real scanner: scan a fixture, feed its report through inferOne, observe a suggestion', {
  skip: existsSync(scannerBin) && existsSync(fixture) ? false : 'scanner binary or fixture missing',
}, async () => {
  // Stand up a fresh git repo seeded from the kotlin-ktor fixture so
  // scan-pr has a real diff to work with. The PR adds a SQL-concat
  // line to the existing repository class — a finding the scanner's
  // S4 detector lights up at confidence ≥ 0.78 with before_lines
  // populated from disk (`read_around`).
  const root = mkdtempSync(join(tmpdir(), 'drift-real-scan-'));
  try {
    cpSync(fixture, root, { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: root });
    const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

    // Inject a fresh SQL-concat shape near the top of save() — gives
    // the scanner a NEW `+` line at a known position so we can be
    // sure inferOne's file-level filter sees it.
    const ordersPath = join(
      root,
      'src/main/kotlin/com/example/repos/OrdersRepository.kt',
    );
    const original = readFileSync(ordersPath, 'utf8');
    const patched = original.replace(
      'fun save(order: Order): Long {',
      'fun save(order: Order): Long {\n        val log = "SELECT * FROM orders WHERE id=" + order.id  // S4 sql-concat',
    );
    assert.notEqual(patched, original, 'patch must apply or the fixture changed');
    writeFileSync(ordersPath, patched);
    execFileSync('git', ['commit', '-am', 'add sql concat'], { cwd: root });
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

    // Write the diff inputs scan-pr expects.
    const changedPath = join(root, '.changed.txt');
    writeFileSync(changedPath, 'src/main/kotlin/com/example/repos/OrdersRepository.kt\n');
    const statsPath = join(root, '.stats.tsv');
    execFileSync('bash', ['-c', `git diff --numstat ${baseSha} ${headSha} > "${statsPath}"`], { cwd: root });
    const commitsPath = join(root, '.commits.txt');
    execFileSync('bash', ['-c', `git log --format=%B%x00 ${baseSha}..${headSha} > "${commitsPath}"`], { cwd: root });
    const reportPath = join(root, 'report.json');

    // Real scan.
    execFileSync(scannerBin, [
      'scan-pr', '.',
      '--changed-files', changedPath,
      '--diff-stats', statsPath,
      '--commits', commitsPath,
      '--base-sha', baseSha,
      '--pr-title=add sql concat',
      '--pr-body=for testing',
      '--output', reportPath,
    ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

    // Sanity-check the scanner's output shape — surface a clearer
    // failure than a downstream type error if the contract drifted.
    const report = loadReport(reportPath);
    assert.ok(
      report.pr_review?.code_suggestions && report.pr_review.code_suggestions.length > 0,
      `scanner produced no code_suggestions — got: ${JSON.stringify(report.pr_review)}`,
    );
    const first = report.pr_review!.code_suggestions![0];
    assert.equal(typeof first.file, 'string', 'file MUST be a string');
    assert.equal(typeof first.line, 'number', 'line MUST be a number');
    assert.ok(first.line! >= 1, 'line must be ≥ 1');
    // before_lines populated → the scanner-window path will be taken.
    assert.ok(
      first.diff && Array.isArray(first.diff.before_lines) && first.diff.before_lines.length > 0,
      `scanner must emit before_lines in production — got: ${JSON.stringify(first.diff)}`,
    );
    const focalRow = first.diff!.before_lines!.find((r) => r.kind === 'del');
    assert.ok(focalRow, 'one row must be kind="del" so the renderer can mark the focal line');

    // Now run inferOne against the freshly-produced report with a
    // stub model so we don't hit the network. The point is to verify
    // the WHOLE chain — real scanner → loadReport → file-level filter
    // → buildFocalUserPrompt → callModel(stub) → envelope.
    const outPath = join(root, 'envelope.json');
    const { logger, messages } = captureLogger();
    let capturedPrompt: string | undefined;
    const callModel: NonNullable<InferOneDeps['callModel']> = async (args) => {
      capturedPrompt = args.user;
      return JSON.stringify({
        suggestions: [
          {
            file: first.file,
            line: focalRow!.line_number!,
            category: first.category,
            confidence: 0.9,
            why_it_matters: 'stubbed reply derived from a real-scanner finding',
            references: [{ url: 'https://example.com/x' }],
            after_code: '        // sanitized',
          },
        ],
      });
    };

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

    // The model WAS called with the scanner-grounded window — proves
    // the scanner's before_lines reached the prompt bytes.
    assert.ok(capturedPrompt, 'callModel must have been invoked');
    assert.match(capturedPrompt!, /code window \(scanner ±3, focal marked ←\):/);
    assert.match(capturedPrompt!, new RegExp(`${focalRow!.line_number}│←`));

    // The envelope received the suggestion.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);

    // And the breadcrumb log names this scanner-flagged location.
    assert.match(
      messages.join('\n'),
      new RegExp(`focal #1: ${first.file.replace(/[.*+?^${}()|[\\\]]/g, '\\$&')}:${first.line}`),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
