import { describe, expect, it } from 'vitest';
import {
  parseDiffHunks,
  analyzeDiff,
  syntheticAddedDiff,
  parseBeats,
  buildSections,
  buildSymbolSections,
  sectionFallbackNote,
  symbolForRange,
  parseHunkNotes,
  parseFileOverview,
  formatSymbolMenu,
  symbolFallbackSegments,
  hunkFallbackSegments,
  buildPresentBeats,
  buildOverviewBeat,
  OVERVIEW_LABEL,
  stripBeatTags,
  estimateReadingMs,
  nearestRenderedLine,
  TEXT_WPM,
  type FileSymbol,
} from './scrollPlan';

const DIFF = [
  '@@ -10,3 +12,3 @@ class Foo',
  ' context',
  '+added one',
  '+added two',
  '@@ -50,1 +60,2 @@',
  ' ctx60',
  '+added61',
  '@@ -100,0 +120,1 @@',
  '+single',
].join('\n');

describe('parseDiffHunks', () => {
  it('extracts NEW-side line ranges + text from @@ headers', () => {
    const hunks = parseDiffHunks(DIFF);
    expect(hunks.map((h) => [h.startLine, h.endLine])).toEqual([
      [12, 14], // +12,3 → 12..14
      [60, 61], // +60,2 → 60..61
      [120, 120], // +120,1 → 120
    ]);
    expect(hunks[0].text).toContain('+added one');
    expect(hunks[0].index).toBe(0);
  });

  it('records the CHANGED span (first/last added new-side line) per hunk', () => {
    const hunks = parseDiffHunks(DIFF);
    // Hunk 1: ' context'(12) '+added one'(13) '+added two'(14) → changed 13..14.
    expect(hunks[0]).toMatchObject({ changedStart: 13, changedEnd: 14 });
    // Hunk 2: ' ctx60'(60) '+added61'(61) → changed 61..61.
    expect(hunks[1]).toMatchObject({ changedStart: 61, changedEnd: 61 });
    // Hunk 3: '+single'(120) → changed 120..120.
    expect(hunks[2]).toMatchObject({ changedStart: 120, changedEnd: 120 });
  });

  it('returns [] for an empty / hunk-less diff', () => {
    expect(parseDiffHunks('')).toEqual([]);
    expect(parseDiffHunks('just some text, no @@')).toEqual([]);
  });
});

describe('nearestRenderedLine', () => {
  it('returns the closest rendered line, ties → the lower one', () => {
    expect(nearestRenderedLine([10, 20, 30], 22)).toBe(20);
    expect(nearestRenderedLine([10, 20, 30], 26)).toBe(30);
    expect(nearestRenderedLine([10, 30], 20)).toBe(10); // tie (|20-10|=|20-30|=10) → lower
    expect(nearestRenderedLine([42], 5)).toBe(42);
    expect(nearestRenderedLine([], 5)).toBeNull();
  });
});

describe('analyzeDiff (numbers the new side for the model to cite)', () => {
  it('numbers +/context lines with real file line numbers and collects the valid set', () => {
    const { numbered, valid, hunks } = analyzeDiff(DIFF);
    expect(numbered).toContain('12:  context'); // context line at new-side 12
    expect(numbered).toContain('13: +added one'); // first add at 13
    expect(numbered).toContain('14: +added two');
    expect(valid.has(12)).toBe(true);
    expect(valid.has(14)).toBe(true);
    expect(valid.has(61)).toBe(true); // the +60,2 hunk's added line
    expect(hunks).toHaveLength(3);
  });

  it('SHOWS removed (−) lines as context (the "before") but gives them no new-side number', () => {
    const diff = ['@@ -1,3 +1,2 @@', ' keep', '-gone before', '+new after'].join('\n');
    const { numbered, valid } = analyzeDiff(diff);
    expect(numbered).toContain('-gone before'); // the removed line is visible to the model
    expect(numbered).toContain('1: '); // context "keep" numbered new-side
    expect(numbered).toContain('2: +new after'); // the add numbered new-side
    expect(valid.has(2)).toBe(true);
    // The removed line is NOT navigable (no new-side number), so it's never a valid pick.
    expect([...valid].some((n) => n > 2)).toBe(false);
  });
});

describe('syntheticAddedDiff (ground a no-diff file on its real content)', () => {
  it('renders content as an all-added hunk that analyzeDiff numbers from line 1', () => {
    const content = 'export const REFUSAL = "x";\nexport function isLowSignalPath(p) {\n  return false;\n}';
    const diff = syntheticAddedDiff(content);
    expect(diff.startsWith('@@ -0,0 +1,4 @@')).toBe(true);
    const { numbered, valid, hunks } = analyzeDiff(diff);
    expect(numbered).toContain('1: +export const REFUSAL'); // real line, navigable
    expect(numbered).toContain('2: +export function isLowSignalPath');
    expect(valid.has(1)).toBe(true);
    expect(valid.has(4)).toBe(true);
    expect(hunks).toHaveLength(1);
  });

  it('caps a huge file to maxLines (stays prompt-sized)', () => {
    const content = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n');
    expect(syntheticAddedDiff(content, 50).split('\n')).toHaveLength(51); // header + 50 lines
  });
});

describe('parseBeats (combined symbol + line picks, ranges tolerated)', () => {
  const { valid } = analyzeDiff(DIFF);
  const symbols: FileSymbol[] = [
    { name: 'Auth', kind: 'class', line: 5, end_line: 40 },
    { name: 'check', kind: 'method', line: 12, end_line: 18, parent: 'Auth' },
    { name: 'login', kind: 'function', line: 20, end_line: 30 },
  ];

  it('parses [L<a>-<b>: <label>] line beats with the button label + note, validating lines', () => {
    const raw = '[L13-14: the two adds] Adds the two lines. [L61: new branch] The new branch.';
    expect(parseBeats(raw, [], valid)).toEqual([
      { startLine: 13, endLine: 14, label: 'the two adds', note: 'Adds the two lines.' },
      { startLine: 61, endLine: 61, label: 'new branch', note: 'The new branch.' },
    ]);
  });

  it('tolerates an L-PREFIXED range second number — `[L222-L231]` (the real model output)', () => {
    expect(parseBeats('[L13-L14: prefixed] Adds them.', [], valid)).toEqual([
      { startLine: 13, endLine: 14, label: 'prefixed', note: 'Adds them.' },
    ]);
  });

  it('drops a hallucinated line (start not shown) and clamps a giant span', () => {
    expect(parseBeats('[L999: nope] no. [L13-9999: huge] huge.', [], valid)).toEqual([
      { startLine: 13, endLine: 53, label: 'huge', note: 'huge.' }, // 999 dropped; clamped +40
    ]);
  });

  it('anchors symbol beats on the EXACT span + carries the name; tolerates an S-RANGE', () => {
    expect(parseBeats('[S2] Validates the password. [S1-S2] The check-login area.', symbols, valid)).toEqual([
      { startLine: 20, endLine: 30, label: 'login', note: 'Validates the password.', name: 'login' },
      // [S1-S2] spans symbol 1's line (12) to symbol 2's end (30); label/name = first symbol.
      { startLine: 12, endLine: 30, label: 'Auth.check', note: 'The check-login area.', name: 'check' },
    ]);
  });

  it('handles MIXED symbol + line tags in order (the model routinely mixes them)', () => {
    const raw = '[S1] Checks the session. [L61: branch] The new branch.';
    expect(parseBeats(raw, symbols, valid)).toEqual([
      { startLine: 12, endLine: 18, label: 'Auth.check', note: 'Checks the session.', name: 'check' },
      { startLine: 61, endLine: 61, label: 'branch', note: 'The new branch.' },
    ]);
  });

  it('drops out-of-range symbol indices and returns [] for plain prose', () => {
    expect(parseBeats('[S9] nope.', symbols, valid)).toEqual([]);
    expect(parseBeats('just prose, no tags', symbols, valid)).toEqual([]);
  });
});

describe('hunkFallbackSegments + buildPresentBeats', () => {
  it('falls back to one labelled segment per hunk', () => {
    const segs = hunkFallbackSegments(parseDiffHunks(DIFF));
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ startLine: 12, endLine: 14, label: 'change at line 12' });
  });

  it('builds beats whose dwell scales with the note length, carrying the label', () => {
    const short = buildPresentBeats([{ startLine: 1, endLine: 2, label: 'x', note: 'tiny.' }], TEXT_WPM);
    const long = buildPresentBeats(
      [{ startLine: 1, endLine: 2, label: 'x', note: Array.from({ length: 100 }, () => 'word').join(' ') }],
      TEXT_WPM,
    );
    expect(long[0].dwellMs).toBeGreaterThan(short[0].dwellMs);
    expect(short[0]).toMatchObject({ startLine: 1, endLine: 2, label: 'x' });
  });
});

describe('buildOverviewBeat (the Level 1+2 top-of-file sweep)', () => {
  const overview = { prChange: 'This PR adds a retry to the auth flow.', purpose: 'Authenticates the user. Validates the session token.' };

  it('sweeps from the file TOP (line 1) down to the first change, dwelling for the L1+L2 read', () => {
    const b = buildOverviewBeat(overview, 130, TEXT_WPM);
    expect(b).toMatchObject({ startLine: 1, endLine: 130, label: OVERVIEW_LABEL, sweep: true });
    expect(b.note).toContain('retry to the auth flow');
    expect(b.note).toContain('Validates the session token');
    expect(b.dwellMs).toBeGreaterThanOrEqual(2500); // a visibly slow sweep, floored
  });

  it('dwells longer when read at the slower VOICE rate (same words)', () => {
    expect(buildOverviewBeat(overview, 5, 155).dwellMs).toBeGreaterThan(buildOverviewBeat(overview, 5, TEXT_WPM).dwellMs);
  });

  it('clamps the sweep target at line 1 for a zero/negative first change', () => {
    expect(buildOverviewBeat(overview, 0, TEXT_WPM).endLine).toBe(1);
  });
});

describe('symbolForRange (innermost symbol a hunk touches)', () => {
  const symbols: FileSymbol[] = [
    { name: '<module>', kind: 'module', line: 1, end_line: 200 }, // the file node — never chosen
    { name: 'Auth', kind: 'class', line: 5, end_line: 40 },
    { name: 'check', kind: 'method', line: 12, end_line: 18, parent: 'Auth' },
    { name: 'login', kind: 'function', line: 60, end_line: 80 },
  ];

  it('returns the SMALLEST (innermost) overlapping symbol, never the file `module` node', () => {
    expect(symbolForRange(symbols, 13, 14)?.name).toBe('check'); // inside Auth AND check → check (smaller)
    expect(symbolForRange(symbols, 30, 35)?.name).toBe('Auth'); // inside Auth only
    expect(symbolForRange(symbols, 60, 70)?.name).toBe('login');
  });

  it('returns undefined when nothing (but the module) overlaps', () => {
    expect(symbolForRange(symbols, 100, 110)).toBeUndefined(); // only the module spans it → skipped
    expect(symbolForRange([], 1, 5)).toBeUndefined();
  });
});

describe('buildSections (deterministic hunk sections — the model only annotates)', () => {
  const symbols: FileSymbol[] = [
    { name: 'Foo', kind: 'class', line: 10, end_line: 30 },
    { name: 'bar', kind: 'method', line: 11, end_line: 16, parent: 'Foo' },
  ];

  it('makes ONE section per hunk, anchored on the first CHANGED line, labeled by the innermost touched symbol or a line range', () => {
    const sections = buildSections(parseDiffHunks(DIFF), symbols);
    expect(sections).toHaveLength(3); // one per hunk in DIFF
    // Hunk's first added line is new-side 13 (line 12 is leading context) → anchor on 13–14,
    // inside Foo.bar (11-16) → labeled + named by the symbol, ref = the hunk diff.
    expect(sections[0]).toMatchObject({ startLine: 13, endLine: 14, label: 'Foo.bar', name: 'bar' });
    expect(sections[0].ref).toContain('+added one');
    // Hunk 60-61: ctx60 then +added61 → anchor on the added line 61, no enclosing symbol.
    expect(sections[1]).toMatchObject({ startLine: 61, endLine: 61, name: undefined });
    expect(sections[1].label).toMatch(/lines 61/);
  });

  it('anchors navigation on the SYMBOL span (not the file top) when a whole-file hunk maps to a mid-file symbol', () => {
    // A new file: ONE hunk covering lines 1..50, but the changed symbol lives at 22–24. The
    // step must scroll to the SYMBOL (22–24), not the file top — the "1→44" bug.
    const wholeFile = ['@@ -0,0 +1,50 @@', ...Array.from({ length: 50 }, (_, i) => `+line ${i + 1}`)].join('\n');
    const syms: FileSymbol[] = [{ name: 'gaugeDisplay', kind: 'function', line: 22, end_line: 24 }];
    const [s] = buildSections(parseDiffHunks(wholeFile), syms);
    expect(s).toMatchObject({ startLine: 22, endLine: 24, label: 'gaugeDisplay', name: 'gaugeDisplay' });
  });

  it('keeps the CHANGED lines (not the whole symbol span) for a tight hunk inside a big function', () => {
    // Change at lines 13–14 inside Foo (10–30): the overlap is the changed lines, so we don't
    // zoom out to the whole 20-line function.
    const sections = buildSections(parseDiffHunks(DIFF), symbols);
    expect(sections[0]).toMatchObject({ startLine: 13, endLine: 14, label: 'Foo.bar' });
  });

  it('falls back to the hunk start for a PURE deletion (no added line to land on)', () => {
    // A hunk that only removes lines has no new-side added line → changedStart undefined.
    const del = '@@ -10,2 +10,0 @@\n-gone one\n-gone two';
    const [h] = parseDiffHunks(del);
    expect(h.changedStart).toBeUndefined();
    const [s] = buildSections([h], []);
    expect(s.startLine).toBe(10); // falls back to the hunk's new-side start
  });

  it('clamps a huge hunk span to maxSpan and caps the section count', () => {
    const big = ['@@ -1,1 +1,300 @@', ...Array.from({ length: 300 }, (_, i) => `+l${i}`)].join('\n');
    const [s] = buildSections(parseDiffHunks(big), [], 40);
    expect(s.endLine - s.startLine).toBe(40); // 1..300 clamped to +40
    // Six hunks max even if there are more.
    const many = Array.from({ length: 9 }, (_, i) => `@@ -1,1 +${i * 5 + 1},1 @@\n+x`).join('\n');
    expect(buildSections(parseDiffHunks(many), [])).toHaveLength(6);
  });
});

describe('buildSymbolSections (annotate-by-symbol for a new / uncached file)', () => {
  const content = [
    'export function gaugeDisplay(scan) {', //  1
    '  return scan.score;', //                 2
    '}', //                                     3
    '', //                                      4
    'export function serializeScan(scan) {', // 5
    '  return JSON.stringify(scan);', //        6
    '}', //                                     7
  ].join('\n');
  const symbols: FileSymbol[] = [
    { name: 'gaugeDisplay', kind: 'function', line: 1, end_line: 3 },
    { name: 'serializeScan', kind: 'function', line: 5, end_line: 7 },
  ];

  it('makes one section per symbol with its CODE shown for the model to annotate', () => {
    const secs = buildSymbolSections(symbols, content);
    expect(secs).toHaveLength(2);
    expect(secs[0]).toMatchObject({ startLine: 1, endLine: 3, label: 'gaugeDisplay', name: 'gaugeDisplay' });
    expect(secs[0].ref).toContain('export function gaugeDisplay');
    expect(secs[1]).toMatchObject({ startLine: 5, endLine: 7, label: 'serializeScan' });
    expect(secs[1].ref).toContain('serializeScan');
  });

  it('labels a method with its parent and caps the span + count', () => {
    expect(buildSymbolSections([{ name: 'check', kind: 'method', line: 2, end_line: 2, parent: 'Auth' }], content)[0].label).toBe('Auth.check');
    const big = buildSymbolSections([{ name: 'huge', kind: 'function', line: 1, end_line: 500 }], content, 40)[0];
    expect(big.endLine - big.startLine).toBe(40); // span clamped
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `f${i}`, kind: 'function' as const, line: i + 1, end_line: i + 1 }));
    expect(buildSymbolSections(many, content)).toHaveLength(6); // count capped
  });
});

describe('sectionFallbackNote (a real signature line, not "The function X")', () => {
  it('returns the first real code line, stripping diff markers and the @@ header', () => {
    expect(sectionFallbackNote('@@ -1,2 +1,3 @@\n+export const X = 1;\n context', 'X')).toBe('export const X = 1;');
    expect(sectionFallbackNote('  function gaugeDisplay(scan) {\n  return 1;', 'gaugeDisplay')).toBe('function gaugeDisplay(scan) {');
  });
  it('falls back to "Change in <label>" only when there is no usable line', () => {
    expect(sectionFallbackNote('', 'foo')).toBe('Change in foo.');
    expect(sectionFallbackNote('@@ -1 +1 @@', 'foo')).toBe('Change in foo.');
  });
});

describe('parseFileOverview (the 3-level header: PR change + file purpose)', () => {
  it('extracts Level 1 (PR) and Level 2 (FILE + DETAIL, joined) from the header lines', () => {
    const raw = 'PR: Adds a retry around the fetch.\nFILE: Streams the scan to the panel.\nDETAIL: Posts each chunk over the port.\n[H0] note';
    const ov = parseFileOverview(raw);
    expect(ov?.prChange).toBe('Adds a retry around the fetch.');
    expect(ov?.purpose).toBe('Streams the scan to the panel. Posts each chunk over the port.');
  });

  it('tolerates a missing DETAIL line and a dash separator', () => {
    expect(parseFileOverview('PR - Bumps the budget.\nFILE: Caps the per-file diff.')).toEqual({
      prChange: 'Bumps the budget.',
      purpose: 'Caps the per-file diff.',
    });
  });

  it('returns null when no header lines are present (caller uses the deterministic fallback)', () => {
    expect(parseFileOverview('[H0] just a change note, no header')).toBeNull();
    expect(parseFileOverview('plain prose')).toBeNull();
  });
});

describe('parseHunkNotes (the model annotates [H<n>] sections it cannot move)', () => {
  it('maps each [H<n>] tag to its one-line note, collapsing whitespace', () => {
    const raw = '[H0] Adds retry with backoff.\n[H1] Guards the null tab.\n[H2] Bumps the budget.';
    const notes = parseHunkNotes(raw);
    expect(notes.get(0)).toBe('Adds retry with backoff.');
    expect(notes.get(1)).toBe('Guards the null tab.');
    expect(notes.get(2)).toBe('Bumps the budget.');
  });

  it('tolerates spacing, ignores preamble before the first tag, and skips empty notes', () => {
    const raw = 'Here you go: [H 0 ]  First   change.  [H1]';
    const notes = parseHunkNotes(raw);
    expect(notes.get(0)).toBe('First change.'); // whitespace collapsed
    expect(notes.has(1)).toBe(false); // no text after [H1] → not stored
  });

  it('returns an empty map for prose with no tags', () => {
    expect(parseHunkNotes('just a paragraph, no tags').size).toBe(0);
  });
});

describe('formatSymbolMenu + symbolFallbackSegments', () => {
  const symbols: FileSymbol[] = [
    { name: 'Auth', kind: 'class', line: 5, end_line: 40 },
    { name: 'check', kind: 'method', line: 12, end_line: 18, parent: 'Auth' },
    { name: 'login', kind: 'function', line: 20, end_line: 30 },
  ];

  it('formats a numbered menu the model picks from', () => {
    expect(formatSymbolMenu(symbols)).toBe(
      ['[S0] Auth (class) L5-40', '[S1] Auth.check (method) L12-18', '[S2] login (function) L20-30'].join('\n'),
    );
  });

  it('symbolFallbackSegments anchors deterministically (model gave no tags / no diff)', () => {
    const segs = symbolFallbackSegments(symbols, 2);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ startLine: 5, endLine: 40, label: 'Auth', name: 'Auth' });
    expect(segs[1]).toMatchObject({ startLine: 12, endLine: 18, label: 'Auth.check', name: 'check' });
  });
});

describe('stripBeatTags', () => {
  it('removes [S<n>] / [H<n>] / [L<a>-<b>] tags, leaving clean prose', () => {
    expect(stripBeatTags('[H1] First. [H2] Second.')).toBe('First. Second.');
    expect(stripBeatTags('[L12-18] Imports. [L40] The method.')).toBe('Imports. The method.');
    expect(stripBeatTags('[S0] The class. [S2] The function.')).toBe('The class. The function.');
    expect(stripBeatTags('no tags here')).toBe('no tags here');
  });

  it('removes the RANGED / PREFIXED tags the model actually emits (the leak bug)', () => {
    // These leaked into the chat message verbatim before the fix.
    expect(stripBeatTags('[S10-S19] [S5-S7] [L222-L231: authorLine note] Verify it.')).toBe('Verify it.');
    expect(stripBeatTags('Lead. [S10-S19] tail.')).toBe('Lead. tail.');
  });
});

describe('estimateReadingMs (word-count ÷ wpm)', () => {
  it('scales with word count and rate, clamped', () => {
    const text = Array.from({ length: 225 }, () => 'word').join(' '); // 225 words
    expect(estimateReadingMs(text, 225, 0, 600000)).toBe(60000); // ~1 min at 225 wpm
    expect(estimateReadingMs(text, 450, 0, 600000)).toBe(30000); // twice the rate → half
    expect(estimateReadingMs('hi', 225)).toBe(1200); // floor
    expect(estimateReadingMs('', 225)).toBe(1200); // empty → floor
  });
});
