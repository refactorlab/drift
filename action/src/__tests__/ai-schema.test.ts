// Schema-validation tests for the AI suggestion envelope.
//
// The JSON Schema lives in src/ai/schema.ts and is also used at
// runtime via a hand-rolled validator (so we don't bundle ajv).
// THIS test compiles the schema with ajv and verifies the fixtures
// and a representative invalid payload — keeping the hand-rolled
// validator honest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Ajv2020Mod from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { AI_SUGGESTION_SCHEMA } from '../ai/schema.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv2020: any = (Ajv2020Mod as any).default ?? Ajv2020Mod;

const fixtureDir = join(import.meta.dirname, '../../.dev');

function buildValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (addFormats as any)(ajv);
  return ajv.compile(AI_SUGGESTION_SCHEMA);
}

test('AI envelope schema: example fixture validates', () => {
  const validate = buildValidator();
  const fx = JSON.parse(
    readFileSync(join(fixtureDir, 'ai-suggestions.example.json'), 'utf8'),
  );
  const ok = validate(fx);
  assert.equal(
    ok,
    true,
    `validation failed: ${JSON.stringify(validate.errors, null, 2)}`,
  );
});

test('AI envelope schema: rejects suggestion without references', () => {
  const validate = buildValidator();
  const bad = {
    suggestions: [
      {
        file: 'src/x.ts',
        line: 1,
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'something happens here that is bad',
        references: [],
        after_code: 'x',
      },
    ],
  };
  const ok = validate(bad);
  assert.equal(ok, false);
  const msg = JSON.stringify(validate.errors);
  assert.match(msg, /references/);
});

test('AI envelope schema: rejects invalid category', () => {
  const validate = buildValidator();
  const bad = {
    suggestions: [
      {
        file: 'src/x.ts',
        line: 1,
        category: 'Z',
        confidence: 0.9,
        why_it_matters: 'long enough text to pass',
        references: [{ url: 'https://example.com' }],
        after_code: 'x',
      },
    ],
  };
  const ok = validate(bad);
  assert.equal(ok, false);
  assert.match(JSON.stringify(validate.errors), /category/);
});

test('AI envelope schema: rejects confidence > 1', () => {
  const validate = buildValidator();
  const bad = {
    suggestions: [
      {
        file: 'src/x.ts',
        line: 1,
        category: 'A',
        confidence: 1.5,
        why_it_matters: 'long enough text to pass',
        references: [{ url: 'https://example.com' }],
        after_code: 'x',
      },
    ],
  };
  const ok = validate(bad);
  assert.equal(ok, false);
  assert.match(JSON.stringify(validate.errors), /confidence/);
});

test('AI envelope schema: rejects bare array (must be {suggestions: [...]} at boundary)', () => {
  const validate = buildValidator();
  const ok = validate([]);
  assert.equal(ok, false, 'bare array must NOT pass the schema; parser does the unwrap');
});

test('AI envelope schema: maxItems = 8', () => {
  const validate = buildValidator();
  const tooMany = {
    suggestions: Array.from({ length: 9 }, () => ({
      file: 'src/x.ts',
      line: 1,
      category: 'A',
      confidence: 0.9,
      why_it_matters: 'long enough text to pass the schema',
      references: [{ url: 'https://example.com' }],
      after_code: 'x',
    })),
  };
  const ok = validate(tooMany);
  assert.equal(ok, false);
  assert.match(JSON.stringify(validate.errors), /maxItems/i);
});
