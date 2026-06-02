import { describe, it, expect } from 'vitest';
import { sanitizeForTts, capSentences, prepareForTts, TTS_MAXLEN } from './ttsSanitize';

// Mirrors the action's audio-sanitize contract (action.yml step 8d): the
// extension synthesizes through the SAME Kokoro/eSpeak pipeline, so the text it
// feeds the model must be shaped the same way.
describe('sanitizeForTts — SSOT parity with the action', () => {
  it('lowercases acronyms (2+ uppercase runs) so eSpeak says pseudo-words', () => {
    expect(sanitizeForTts('We touched the API and the JSON parser.')).toBe(
      'We touched the api and the json parser.',
    );
  });

  it('de-spells file extensions: letter-dot-letter → space', () => {
    expect(sanitizeForTts('Edited comment.test.ts and runtime.ts.')).toBe(
      'Edited comment test ts and runtime ts.',
    );
  });

  it('strips thousands commas and caps long digit runs to "number"', () => {
    expect(sanitizeForTts('It touched 12,345 lines in commit a1b2c3d4e5.')).toBe(
      'It touched number lines in commit a1b2c3d4e5.',
    );
    // 4-digit years / short versions survive (run < 5 digits).
    expect(sanitizeForTts('Released in 2026.')).toBe('Released in 2026.');
  });

  it('folds weak terminators to "." and drops anything outside the keep-set', () => {
    expect(sanitizeForTts('Risk: high! Ready? Yes; go — now 🎉')).toBe(
      'Risk. high. Ready. Yes. go now',
    );
  });

  it('collapses repeated spaces/dots and trims', () => {
    expect(sanitizeForTts('  hello   world ...  ')).toBe('hello world.');
  });

  it("keeps apostrophes and commas for natural prosody", () => {
    expect(sanitizeForTts("don't break, please.")).toBe("don't break, please.");
  });
});

describe('capSentences — no chunk overruns the cap', () => {
  it('leaves short sentences untouched', () => {
    expect(capSentences('A short one. And another.')).toBe('A short one. And another.');
  });

  it('splits an over-long sentence so every chunk stays within the cap', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(', ');
    const out = capSentences(`${long}.`, TTS_MAXLEN);
    for (const sentence of out.split('. ')) {
      expect(sentence.length).toBeLessThanOrEqual(TTS_MAXLEN + 1); // +1 for the trailing dot
    }
  });

  it('protects decimal/version numbers from the sentence splitter', () => {
    expect(capSentences('Version 1.2.3 ships pi 3.14 today.')).toContain('1.2.3');
    expect(capSentences('Version 1.2.3 ships pi 3.14 today.')).toContain('3.14');
  });

  it('hard-cuts a single comma-less monster at a space', () => {
    const monster = 'a'.repeat(60) + ' ' + 'b'.repeat(80);
    const out = capSentences(`${monster}.`, TTS_MAXLEN);
    for (const s of out.split('. ')) expect(s.replace(/\.$/, '').length).toBeLessThanOrEqual(TTS_MAXLEN);
  });
});

describe('prepareForTts — full pipeline', () => {
  it('sanitises then caps in one call', () => {
    expect(prepareForTts('API change in comment.test.ts.')).toBe('api change in comment test ts.');
  });
  it('returns empty when nothing survives sanitising', () => {
    expect(prepareForTts('🎉🚀✨')).toBe('');
  });
});
