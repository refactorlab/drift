import { describe, it, expect } from 'vitest';
import { takeSentences } from './sentenceStream';

describe('takeSentences', () => {
  it('flushes complete sentences and keeps the partial tail', () => {
    const { sentences, rest } = takeSentences('The worst issue is timing. Check auth');
    expect(sentences).toEqual(['The worst issue is timing.']);
    expect(rest.trim()).toBe('Check auth');
  });

  it('handles multiple sentences and ! ?', () => {
    const { sentences, rest } = takeSentences('Yes! Are you sure? Maybe');
    expect(sentences).toEqual(['Yes!', 'Are you sure?']);
    expect(rest.trim()).toBe('Maybe');
  });

  it('does not split a decimal mid-stream', () => {
    const { sentences, rest } = takeSentences('Drift rose by 3.14');
    expect(sentences).toEqual([]);
    expect(rest).toBe('Drift rose by 3.14');
  });

  it('returns nothing for an empty buffer', () => {
    expect(takeSentences('')).toEqual({ sentences: [], rest: '' });
  });
});
