// parse-comment: the /drift trigger argument parser.
//
// We invoke action/scripts/parse-comment.mjs as a child node process with
// COMMENT_BODY set in the env and GITHUB_OUTPUT pointed at a temp file.
// The test asserts on the lines written to that temp file (the same
// contract action.yml relies on).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../scripts/parse-comment.mjs', import.meta.url));

type Run = { code: number | null; stdout: string; stderr: string; outputs: Record<string, string> };

function run(body: string): Run {
  const dir = mkdtempSync(join(tmpdir(), 'drift-parse-'));
  const ghOut = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(ghOut, '');
  const r = spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, COMMENT_BODY: body, GITHUB_OUTPUT: ghOut },
    encoding: 'utf8',
  });
  const outputs: Record<string, string> = {};
  for (const line of readFileSync(ghOut, 'utf8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) outputs[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, outputs };
}

test('parse-comment: empty body → no outputs', () => {
  const r = run('');
  assert.equal(r.code, 0);
  assert.deepEqual(r.outputs, {});
});

test('parse-comment: bare /drift → no outputs', () => {
  const r = run('/drift');
  assert.equal(r.code, 0);
  assert.deepEqual(r.outputs, {});
});

test('parse-comment: one-liner key=value', () => {
  const r = run('/drift debug=true');
  assert.equal(r.outputs.debug, 'true');
});

test('parse-comment: multiple one-liner args', () => {
  const r = run('/drift debug=true ai-model=openai/gpt-5 ai-suggestions=false');
  assert.equal(r.outputs.debug, 'true');
  assert.equal(r.outputs['ai-model'], 'openai/gpt-5');
  assert.equal(r.outputs['ai-suggestions'], 'false');
});

test('parse-comment: unknown key → warning, dropped', () => {
  const r = run('/drift debug=true totally-fake-key=lol');
  assert.equal(r.outputs.debug, 'true');
  assert.equal(r.outputs['totally-fake-key'], undefined);
  assert.match(r.stdout, /::warning::Ignoring unknown \/drift arg: totally-fake-key/);
});

test('parse-comment: fenced YAML block', () => {
  const body = [
    '/drift',
    '',
    '```yaml',
    'debug: true',
    'ai-model: openai/gpt-5',
    'fail-threshold: 0',
    '```',
    '',
    'with some prose after',
  ].join('\n');
  const r = run(body);
  assert.equal(r.outputs.debug, 'true');
  assert.equal(r.outputs['ai-model'], 'openai/gpt-5');
  assert.equal(r.outputs['fail-threshold'], '0');
});

test('parse-comment: one-liner overrides fenced YAML', () => {
  const body = [
    '/drift ai-model=openai/gpt-4o',
    '```yaml',
    'ai-model: openai/gpt-5',
    'debug: true',
    '```',
  ].join('\n');
  const r = run(body);
  assert.equal(r.outputs['ai-model'], 'openai/gpt-4o', 'one-liner should win');
  assert.equal(r.outputs.debug, 'true', 'YAML-only keys still merge through');
});

test('parse-comment: malformed YAML → warning, no outputs from block', () => {
  const body = [
    '/drift',
    '```yaml',
    'this is :: not :: valid :: yaml :: at: all: [unterminated',
    '```',
  ].join('\n');
  const r = run(body);
  assert.deepEqual(r.outputs, {});
  assert.match(r.stdout, /::warning::Could not parse fenced YAML/);
});

test('parse-comment: newline in value is sanitized', () => {
  // Comment bodies can't reasonably embed a literal \n in a one-liner value,
  // but a fenced YAML can. The sanitizer collapses CR/LF to space so the
  // value never injects an extra $GITHUB_OUTPUT line.
  const body = [
    '/drift',
    '```yaml',
    'ai-model: "openai/gpt-5\\nrogue=value"',  // YAML escape only, decoded after parse
    '```',
  ].join('\n');
  const r = run(body);
  assert.ok(!('rogue' in r.outputs), 'embedded newline must not split into a second output');
  // The model field is still set; whitespace squashed.
  assert.match(r.outputs['ai-model'] ?? '', /openai\/gpt-5/);
});

test('parse-comment: /drift not on first line still parsed', () => {
  const body = ['hey can you', '/drift debug=true'].join('\n');
  const r = run(body);
  assert.equal(r.outputs.debug, 'true');
});

test('parse-comment: /drift issue → open-issue=true', () => {
  const r = run('/drift issue');
  assert.equal(r.outputs['open-issue'], 'true');
});

test('parse-comment: /drift issue with overrides → both', () => {
  const r = run('/drift issue ai-model=openai/gpt-5');
  assert.equal(r.outputs['open-issue'], 'true');
  assert.equal(r.outputs['ai-model'], 'openai/gpt-5');
});

test('parse-comment: open-issue=true key=value form also works', () => {
  const r = run('/drift open-issue=true');
  assert.equal(r.outputs['open-issue'], 'true');
});

test('parse-comment: bare /drift does NOT set open-issue', () => {
  const r = run('/drift debug=true');
  assert.equal(r.outputs['open-issue'], undefined);
});
