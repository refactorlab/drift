import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { setPrContext, getSavedPrContext, clearPrData } from './prContext';
import { emptyReport, type PrContext } from '../core/types';

function ctxFor(url: string): PrContext {
  return {
    pr: { owner: 'o', repo: 'r', number: 70, title: 't', url },
    report: { ...emptyReport(), found: true },
    artifacts: [
      { name: 'pr-scan.json', url: `${url}#a`, kind: 'scan-report' },
      { name: 'pr-scan-context.json', kind: 'scan-context' }, // no url — must be skipped
    ],
    detectedAt: 0,
  };
}

describe('prContext (per-PR storage + clear)', () => {
  let store: Map<string, unknown>;
  beforeEach(() => {
    store = installChromeMock().store;
  });

  it('saves + restores a report scoped to the PR url', async () => {
    const ctx = ctxFor('U');
    await setPrContext(ctx);
    expect(store.has('drift:pr:U')).toBe(true);
    expect((await getSavedPrContext('U'))?.pr.number).toBe(70);
    expect(await getSavedPrContext('OTHER')).toBeNull();
  });

  it('clearPrData removes report + chat + every downloadable artifact + its download record', async () => {
    const ctx = ctxFor('U');
    store.set('drift:pr:U', ctx);
    store.set('drift:chat:U', []);
    store.set('drift:artifact:U#a', {});
    store.set('drift:download:U#a', {});
    // unrelated PR — must survive
    store.set('drift:pr:V', {});

    await clearPrData(ctx);

    expect(store.has('drift:pr:U')).toBe(false);
    expect(store.has('drift:chat:U')).toBe(false);
    expect(store.has('drift:artifact:U#a')).toBe(false);
    expect(store.has('drift:download:U#a')).toBe(false);
    expect(store.has('drift:pr:V')).toBe(true);
  });
});
