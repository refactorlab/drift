import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { loadAudio } from './audio';
import type { AudioRef } from '../core/types';

const AUDIO: AudioRef = {
  url: 'https://github.com/o/r/actions/runs/1/artifacts/2',
  label: '🔊 Listen to the spoken summary',
};

describe('loadAudio (end-to-end through the messaging layer)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('sends a binary FETCH_ARTIFACT and returns the data URL', async () => {
    const seen = vi.fn();
    mock.setResponder((msg) => {
      seen(msg);
      return {
        ok: true,
        fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 321 },
      };
    });
    const res = await loadAudio(AUDIO);
    expect(seen).toHaveBeenCalledWith({ type: 'FETCH_ARTIFACT', url: AUDIO.url, binary: true });
    expect(res).toEqual({ ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 321 });
  });

  it('surfaces a worker-level download failure', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    expect(await loadAudio(AUDIO)).toEqual({ ok: false, error: 'HTTP 404' });
  });

  it('surfaces a runtime-level error response', async () => {
    mock.setResponder(() => ({ ok: false, error: 'no content script' }));
    expect(await loadAudio(AUDIO)).toEqual({ ok: false, error: 'no content script' });
  });

  it('defaults the mime when the worker omits it', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: true, dataUrl: 'data:x;base64,AA' } }));
    const res = await loadAudio(AUDIO);
    expect(res).toMatchObject({ ok: true, mime: 'audio/mpeg' });
  });
});
