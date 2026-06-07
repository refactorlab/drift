import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { getCachedZipSize, setCachedZipSize } from './downloadSizeEstimate';

describe('zip-size cache', () => {
  beforeEach(() => installChromeMock());

  it('round-trips a size keyed by owner/repo (case-insensitive)', async () => {
    expect(await getCachedZipSize('o', 'r')).toBeUndefined();
    await setCachedZipSize('o', 'r', 12345);
    expect(await getCachedZipSize('o', 'r')).toBe(12345);
    // Lookups are case-insensitive so casing variants share one cache entry.
    expect(await getCachedZipSize('O', 'R')).toBe(12345);
  });

  it('keeps per-repo entries independent', async () => {
    await setCachedZipSize('o', 'a', 100);
    await setCachedZipSize('o', 'b', 200);
    expect(await getCachedZipSize('o', 'a')).toBe(100);
    expect(await getCachedZipSize('o', 'b')).toBe(200);
  });

  it('overwrites with the latest measured size', async () => {
    await setCachedZipSize('o', 'r', 100);
    await setCachedZipSize('o', 'r', 250);
    expect(await getCachedZipSize('o', 'r')).toBe(250);
  });

  it('ignores non-positive sizes on write and read', async () => {
    await setCachedZipSize('o', 'r', 0);
    expect(await getCachedZipSize('o', 'r')).toBeUndefined();
    await setCachedZipSize('o', 'r', -5);
    expect(await getCachedZipSize('o', 'r')).toBeUndefined();
  });
});
