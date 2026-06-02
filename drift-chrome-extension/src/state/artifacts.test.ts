import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { getStoredArtifact, loadArtifact, purgeDerivedCache, artifactIdFromUrl } from './artifacts';
import type { ArtifactRef } from '../core/types';

describe('artifacts store — derived-cache self-heal', () => {
  let store: Map<string, unknown>;
  beforeEach(() => {
    store = installChromeMock().store;
  });

  it('purges a legacy derived cache entry on read (forces real re-download)', async () => {
    store.set('drift:artifact:U', {
      url: 'U',
      name: 'pr-scan.json',
      content: '{"schema":"drift.pr-scan/derived-v1"}',
      bytes: 1,
      loadedAt: 0,
    });
    expect(await getStoredArtifact('U')).toBeNull();
    expect(store.has('drift:artifact:U')).toBe(false); // removed
  });

  it('returns a real cached artifact untouched', async () => {
    const real = { url: 'U', name: 'pr-scan.json', content: '{"pr_review":{}}', bytes: 5, loadedAt: 1 };
    store.set('drift:artifact:U', real);
    expect(await getStoredArtifact('U')).toEqual(real);
  });

  it('purgeDerivedCache drops derived entries, keeps real ones', async () => {
    store.set('drift:artifact:a', { content: 'Reconstructed locally from the rendered comment' });
    store.set('drift:artifact:b', { content: '{"pr_review_ext":{}}' });
    store.set('drift:other', { content: 'derived-v1' }); // not an artifact key — untouched
    await purgeDerivedCache();
    expect(store.has('drift:artifact:a')).toBe(false);
    expect(store.has('drift:artifact:b')).toBe(true);
    expect(store.has('drift:other')).toBe(true);
  });

  it('parses the artifact id from a GitHub artifacts URL', () => {
    expect(artifactIdFromUrl('https://github.com/o/r/actions/runs/9/artifacts/7332395495')).toBe(
      '7332395495',
    );
    expect(artifactIdFromUrl(undefined)).toBeUndefined();
  });
});

describe('loadArtifact (download → cache, end-to-end)', () => {
  let mock: ChromeMock;
  const ref: ArtifactRef = {
    name: 'pr-scan.json',
    url: 'https://github.com/o/r/actions/runs/9/artifacts/7332395495',
    kind: 'scan-report',
  };
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('returns the downloaded JSON and caches it under drift:artifact:<url>', async () => {
    mock.setResponder(() => ({
      ok: true,
      fetched: { ok: true, text: '{"pr_review":{}}', bytes: 4096 },
    }));
    const res = await loadArtifact(ref);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.rec.content).toBe('{"pr_review":{}}');
      expect(res.rec.downloadedBytes).toBe(4096);
      expect(res.rec.id).toBe('7332395495');
    }
    // Subsequent reads hit the cache (no responder needed).
    const cached = await getStoredArtifact(ref.url!);
    expect(cached?.content).toBe('{"pr_review":{}}');
  });

  it('errors (without caching) when there is no download URL', async () => {
    const res = await loadArtifact({ name: 'x.json', kind: 'scan-report' });
    expect(res).toEqual({ ok: false, error: 'no download URL on this PR' });
  });

  it('surfaces a worker download failure', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    expect(await loadArtifact(ref)).toEqual({ ok: false, error: 'HTTP 404' });
    expect(await getStoredArtifact(ref.url!)).toBeNull();
  });
});
