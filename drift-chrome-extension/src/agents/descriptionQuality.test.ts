import { describe, expect, it } from 'vitest';
import {
  hasConcreteAnchor,
  isVacuous,
  splitSentences,
  tightenDescription,
  wordCount,
} from './descriptionQuality';

describe('hasConcreteAnchor', () => {
  it('finds real code anchors — camelCase, snake_case, calls, paths, quotes', () => {
    expect(hasConcreteAnchor('Generates the voicePrompt rule')).toBe(true); // camelCase
    expect(hasConcreteAnchor('reads low_signal flags')).toBe(true); // snake_case
    expect(hasConcreteAnchor('calls serializeScan() once')).toBe(true); // call
    expect(hasConcreteAnchor('edits voicePrompt.ts')).toBe(true); // path/extension
    expect(hasConcreteAnchor('wraps the "DriftReport" type')).toBe(true); // quoted
  });

  it('is false for plain prose with no identifiers', () => {
    expect(hasConcreteAnchor('handles the voice prompt functionality for the app')).toBe(false);
  });
});

describe('isVacuous', () => {
  it('rejects filler-verb + generic-noun non-descriptions', () => {
    expect(isVacuous('This file implements the voice prompt functionality')).toBe(true);
    expect(isVacuous('Provides various features')).toBe(true);
    expect(isVacuous('is responsible for some aspects')).toBe(true);
  });

  it('rejects descriptions that are too thin', () => {
    expect(isVacuous('Voice prompts.')).toBe(true); // < 3 words
    expect(isVacuous('')).toBe(true);
  });

  it('keeps descriptions that name real code, even with filler words', () => {
    // "...functionality" but anchored on a real symbol → still informative.
    expect(isVacuous('Implements the gaugeDisplay functionality')).toBe(false);
    expect(isVacuous('Builds the spoken-path rule for the TTS')).toBe(false);
    // "logic"/"operations" are NOT treated as empty — "retry logic" is a real description.
    expect(isVacuous('Adds retry logic to the auth flow')).toBe(false);
  });
});

describe('splitSentences', () => {
  it('splits on terminators before a capital, not on code dots or abbreviations', () => {
    expect(splitSentences('Renders the run. Polls the scanner.')).toEqual([
      'Renders the run.',
      'Polls the scanner.',
    ]);
    // A code path dot must NOT split the sentence.
    expect(splitSentences('Edits voicePrompt.ts in place.')).toEqual(['Edits voicePrompt.ts in place.']);
    // A lowercase abbreviation must NOT split.
    expect(splitSentences('Caps lines, e.g. the long ones.')).toEqual(['Caps lines, e.g. the long ones.']);
  });

  it('collapses whitespace and drops empties', () => {
    expect(splitSentences('  One.   Two.  ')).toEqual(['One.', 'Two.']);
  });
});

describe('tightenDescription', () => {
  it('returns "" for empty / missing input', () => {
    expect(tightenDescription(undefined, { maxSentences: 1 })).toBe('');
    expect(tightenDescription('   ', { maxSentences: 1 })).toBe('');
  });

  it('keeps a single concrete sentence unchanged (exact)', () => {
    expect(tightenDescription('Adds estimated download progress.', { maxSentences: 1 })).toBe(
      'Adds estimated download progress.',
    );
  });

  it('adds a terminal period when missing', () => {
    expect(tightenDescription('Renders the live run', { maxSentences: 1 })).toBe('Renders the live run.');
  });

  it('clamps a ramble to the informative head', () => {
    const ramble = 'Renders the live run. Polls the scanner. Shows a spinner. Logs progress.';
    expect(tightenDescription(ramble, { maxSentences: 2 })).toBe('Renders the live run. Polls the scanner.');
  });

  it('DROPS a leading vacuous opener and keeps the concrete remainder', () => {
    // The bug report's shape: a content-free opener, then an anchored sentence.
    const text =
      'This file implements the voice prompt functionality for the app. The voicePrompt module builds the spoken-path rule.';
    expect(tightenDescription(text, { maxSentences: 2 })).toBe('The voicePrompt module builds the spoken-path rule.');
  });

  it('returns "" when EVERY sentence is vacuous (caller falls back to the grounded line)', () => {
    expect(tightenDescription('This file implements the functionality. It handles various features.', { maxSentences: 2 })).toBe('');
  });
});

describe('wordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(wordCount('one two three')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
});
