import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { setLiveContext, getLiveContext, clearLiveContext, isLiveContextChange } from './liveContext';
import { emptyReport, type PrContext } from '../core/types';

function ctxFor(url: string): PrContext {
  return {
    pr: { owner: 'o', repo: 'r', number: 70, title: 't', url },
    report: { ...emptyReport(), found: true },
    artifacts: [],
    detectedAt: 0,
  };
}

describe('liveContext (per-PR live-scan grounding)', () => {
  let store: Map<string, unknown>;
  beforeEach(() => {
    store = installChromeMock().store;
  });

  it('round-trips a synthesized context under a dedicated key', async () => {
    const url = 'https://github.com/o/r/pull/70';
    await setLiveContext(ctxFor(url));
    expect(store.has(`drift:livectx:${url}`)).toBe(true);
    expect((await getLiveContext(url))?.pr.number).toBe(70);
    expect(await getLiveContext('https://github.com/o/r/pull/99')).toBeNull();
  });

  it('clearLiveContext removes only the targeted PR', async () => {
    await setLiveContext(ctxFor('A'));
    await setLiveContext(ctxFor('B'));
    await clearLiveContext('A');
    expect(await getLiveContext('A')).toBeNull();
    expect(await getLiveContext('B')).not.toBeNull();
  });

  it('isLiveContextChange recognizes only its own keyspace', () => {
    expect(isLiveContextChange({ 'drift:livectx:x': { newValue: 1 } })).toBe(true);
    expect(isLiveContextChange({ 'drift:pr:x': { newValue: 1 } })).toBe(false);
  });
});
