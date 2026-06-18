import { describe, expect, it } from 'vitest';
import { pickMeaningful, splitSigned, summarizeChange } from './changeSummary';

describe('splitSigned', () => {
  it('splits +/- lines, strips markers, and drops the @@ header', () => {
    const ref = '@@ -1,2 +1,3 @@\n+const a = 1;\n-const b = 2;\n unchanged';
    expect(splitSigned(ref)).toEqual({
      added: ['const a = 1;'],
      removed: ['const b = 2;'],
      plain: ['unchanged'],
    });
  });

  it('treats unprefixed code (a symbol section) as plain lines', () => {
    expect(splitSigned('export function f() {\n  return 1;\n}')).toEqual({
      added: [],
      removed: [],
      plain: ['export function f() {', 'return 1;', '}'],
    });
  });
});

describe('pickMeaningful', () => {
  it('prefers a declaration over a brace', () => {
    expect(pickMeaningful(['{', 'export const X = 1;', '}'])).toBe('export const X = 1;');
  });

  it('recognises a JSX element as meaningful', () => {
    expect(pickMeaningful(['{', '<StepRow active />'])).toBe('<StepRow active />');
  });

  it('falls back to the first non-trivial line, then ""', () => {
    expect(pickMeaningful(['{', '})'])).toBe('})');
    expect(pickMeaningful([])).toBe('');
  });
});

describe('summarizeChange', () => {
  it('describes a pure addition', () => {
    expect(summarizeChange('@@ -0,0 +1 @@\n+export function fmtMs(ms) {', 'fmtMs')).toBe(
      'Adds export function fmtMs(ms) {',
    );
  });

  it('describes a pure removal', () => {
    expect(summarizeChange('@@ -1 +0,0 @@\n-const old = 1;', 'old')).toBe('Removes const old = 1;');
  });

  it('describes a mixed edit by its NEW line, labelled', () => {
    expect(summarizeChange('@@ -1 +1 @@\n-let x = 1;\n+let x = 2;', 'x')).toBe('Updates x: let x = 2;');
  });

  it('uses the signature for a no-diff symbol section', () => {
    expect(summarizeChange('export function loadWasmModule() {\n  return wasm;', 'loadWasmModule')).toBe(
      'export function loadWasmModule() {',
    );
  });

  it('only says "Change in X" when the ref is genuinely empty — the bug report case', () => {
    expect(summarizeChange('', 'StepRow')).toBe('Change in StepRow.');
    expect(summarizeChange('@@ -1 +1 @@', 'StepRow')).toBe('Change in StepRow.');
  });

  it('clips a very long line', () => {
    const note = summarizeChange(`+${'a'.repeat(300)}`, 'x');
    expect(note.length).toBeLessThanOrEqual(120);
    expect(note.endsWith('…')).toBe(true);
  });
});
