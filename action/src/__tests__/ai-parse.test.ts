// Tests for the runtime parser/validator in src/ai/parse.ts.
//
// Covers:
//   - fence stripping (```json + preamble)
//   - bare-array shape tolerance
//   - quality bar filtering (cap + diff-anchoring live in the caller now)
//   - schema rejection paths

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAIOutput, stripFence } from '../ai/parse.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');

test('stripFence: removes ```json fence and preamble', () => {
  const raw = readFileSync(join(fixtureDir, 'ai-suggestions.fenced.txt'), 'utf8');
  const inner = stripFence(raw);
  assert.ok(inner.startsWith('{'), `expected JSON start, got: ${inner.slice(0, 80)}`);
  assert.ok(inner.endsWith('}'), `expected JSON end, got: ${inner.slice(-80)}`);
});

test('stripFence: passes through plain JSON unchanged', () => {
  const raw = '{"suggestions": []}';
  assert.equal(stripFence(raw), raw);
});

test('parseAIOutput: clean envelope from example.json (no cap — returns all passing)', () => {
  const raw = readFileSync(join(fixtureDir, 'ai-suggestions.example.json'), 'utf8');
  const r = parseAIOutput(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.total, 4);
    assert.equal(r.passing, 4, 'all four fixture entries clear the bar');
    assert.equal(r.suggestions.length, 4, 'parse no longer caps — caller does');
  }
});

test('parseAIOutput: fenced markdown still parses', () => {
  const raw = readFileSync(join(fixtureDir, 'ai-suggestions.fenced.txt'), 'utf8');
  const r = parseAIOutput(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.suggestions.length, 1);
    assert.equal(r.suggestions[0].file, 'src/users/service.py');
  }
});

test('parseAIOutput: bare array is normalized into envelope', () => {
  const raw = readFileSync(join(fixtureDir, 'ai-suggestions.bare-array.txt'), 'utf8');
  const r = parseAIOutput(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.suggestions.length, 1);
    assert.equal(r.suggestions[0].file, 'src/x.ts');
  }
});

test('parseAIOutput: quality bar drops low-confidence + no-ref entries', () => {
  const env = {
    suggestions: [
      {
        file: 'a.ts',
        line: 1,
        category: 'A',
        confidence: 0.5, // ← dropped
        why_it_matters: 'long enough text here please',
        references: [{ url: 'https://x.com' }],
        after_code: 'x',
      },
      {
        file: 'b.ts',
        line: 1,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'long enough text here please',
        references: [{ url: '' }], // ← rejected by SCHEMA (url minLength=1), never reaches quality bar
        after_code: 'x',
      },
    ],
  };
  const r = parseAIOutput(JSON.stringify(env));
  // schema rejects on the second entry's empty url
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.reason, /references\[0\]\.url/);
  }
});

test('parseAIOutput: quality bar (good schema, low confidence) returns empty list', () => {
  const env = {
    suggestions: [
      {
        file: 'a.ts',
        line: 1,
        category: 'A',
        confidence: 0.5,
        why_it_matters: 'long enough text here please',
        references: [{ url: 'https://x.com' }],
        after_code: 'x',
      },
    ],
  };
  const r = parseAIOutput(JSON.stringify(env));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.total, 1);
    assert.equal(r.passing, 0);
    assert.equal(r.suggestions.length, 0);
  }
});

test('parseAIOutput: empty input rejected', () => {
  const r = parseAIOutput('');
  assert.equal(r.ok, false);
});

test('parseAIOutput: malformed JSON rejected with reason', () => {
  const r = parseAIOutput('{not json');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.reason, /JSON parse failed/);
  }
});

test('parseAIOutput: invalid line (non-integer) rejected by schema', () => {
  const env = {
    suggestions: [
      {
        file: 'a.ts',
        line: 1.5,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'long enough text here please',
        references: [{ url: 'https://x.com' }],
        after_code: 'x',
      },
    ],
  };
  const r = parseAIOutput(JSON.stringify(env));
  assert.equal(r.ok, false);
});

test('parseAIOutput: start_line > line rejected', () => {
  const env = {
    suggestions: [
      {
        file: 'a.ts',
        start_line: 10,
        line: 5,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'long enough text here please',
        references: [{ url: 'https://x.com' }],
        after_code: 'x',
      },
    ],
  };
  const r = parseAIOutput(JSON.stringify(env));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.reason, /start_line/);
  }
});
