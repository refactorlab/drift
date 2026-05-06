import { test, expect } from 'bun:test';
import { verifySignature, signBody } from '../github/signature.ts';

const SECRET = 'It\'s a Secret to Everybody';
// Canonical example from the GitHub docs.
const BODY = 'Hello, World!';
const EXPECTED = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';

test('signBody produces the canonical GitHub example signature', async () => {
  const sig = await signBody(SECRET, BODY);
  expect(sig).toBe(EXPECTED);
});

test('verifySignature accepts a correct signature', async () => {
  expect(await verifySignature(SECRET, BODY, EXPECTED)).toBe(true);
});

test('verifySignature rejects a tampered body', async () => {
  expect(await verifySignature(SECRET, 'Hello, world!', EXPECTED)).toBe(false);
});

test('verifySignature rejects a bad secret', async () => {
  expect(await verifySignature('wrong-secret', BODY, EXPECTED)).toBe(false);
});

test('verifySignature rejects unprefixed signature', async () => {
  const naked = EXPECTED.slice('sha256='.length);
  expect(await verifySignature(SECRET, BODY, naked)).toBe(false);
});

test('verifySignature rejects undefined header', async () => {
  expect(await verifySignature(SECRET, BODY, undefined)).toBe(false);
});

test('verifySignature is length-safe (mismatched length)', async () => {
  expect(await verifySignature(SECRET, BODY, 'sha256=abc')).toBe(false);
});

test('verifySignature roundtrips on arbitrary bodies', async () => {
  const body = JSON.stringify({ action: 'opened', pull_request: { number: 42 } });
  const sig = await signBody('topsecret', body);
  expect(await verifySignature('topsecret', body, sig)).toBe(true);
});
