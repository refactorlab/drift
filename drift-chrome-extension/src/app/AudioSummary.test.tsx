import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { AudioSummary } from './AudioSummary';
import type { AudioRef } from '../core/types';

const AUDIO: AudioRef = {
  url: 'https://github.com/o/r/actions/runs/1/artifacts/2',
  label: '🔊 Listen to the spoken summary (Piper TTS)',
};

describe('<AudioSummary>', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
    // jsdom doesn't implement media playback; the component best-effort autoplay.
    vi.stubGlobal('HTMLMediaElement', HTMLMediaElement);
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('shows the label and a play button before loading', () => {
    render(<AudioSummary audio={AUDIO} />);
    expect(screen.getByText(/spoken summary/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /play summary/i })).toBeTruthy();
  });

  it('downloads on click and reveals an <audio> with the data URL', async () => {
    mock.setResponder(() => ({
      ok: true,
      fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 9 },
    }));
    const { container } = render(<AudioSummary audio={AUDIO} />);
    fireEvent.click(screen.getByRole('button', { name: /play summary/i }));

    await waitFor(() => {
      const audio = container.querySelector('audio');
      expect(audio).toBeTruthy();
      expect(audio!.getAttribute('src')).toBe('data:audio/mpeg;base64,AAAA');
    });
  });

  it('hydrates straight from cache (no download) when the artifact was already loaded', async () => {
    // Seed the cache as if this exact artifact had been downloaded before.
    await chrome.storage.local.set({
      [`drift:audio:${AUDIO.url}`]: {
        url: AUDIO.url,
        dataUrl: 'data:audio/mpeg;base64,CACHED',
        mime: 'audio/mpeg',
        bytes: 9,
        loadedAt: 1,
      },
    });
    const responder = vi.fn(() => ({ ok: false, error: 'should not be called' }));
    mock.setResponder(responder);

    const { container } = render(<AudioSummary audio={AUDIO} />);

    // The player appears with no play-button press and no worker download.
    await waitFor(() => {
      const audio = container.querySelector('audio');
      expect(audio).toBeTruthy();
      expect(audio!.getAttribute('src')).toBe('data:audio/mpeg;base64,CACHED');
    });
    expect(responder).not.toHaveBeenCalled();
  });

  it('does NOT re-download when you switch away to another PR and back (the reported bug)', async () => {
    const AUDIO_B: AudioRef = {
      url: 'https://github.com/o/r/actions/runs/9/artifacts/9',
      label: '🔊 Listen to the spoken summary (Piper TTS)',
    };
    const downloads = vi.fn();
    mock.setResponder((msg) => {
      const m = msg as { type?: string; url?: string };
      if (m.type === 'FETCH_ARTIFACT') {
        downloads(m.url);
        return {
          ok: true,
          fetched: { ok: true, dataUrl: `data:audio/mpeg;base64,${m.url}`, mime: 'audio/mpeg', bytes: 9 },
        };
      }
      return { ok: true };
    });

    // Mount on PR A and play it → one real download.
    const { container, rerender } = render(<AudioSummary audio={AUDIO} />);
    fireEvent.click(screen.getByRole('button', { name: /play summary/i }));
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy());
    expect(downloads).toHaveBeenCalledTimes(1);

    // Switch to PR B (same mounted component, prop changes) and play it → second download.
    rerender(<AudioSummary audio={AUDIO_B} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /play summary/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /play summary/i }));
    await waitFor(() => expect(container.querySelector('audio')?.getAttribute('src')).toContain('artifacts/9'));
    expect(downloads).toHaveBeenCalledTimes(2);

    // Switch BACK to PR A → it hydrates from cache, no third download, no press needed.
    rerender(<AudioSummary audio={AUDIO} />);
    await waitFor(() =>
      expect(container.querySelector('audio')?.getAttribute('src')).toContain('artifacts/2'),
    );
    expect(downloads).toHaveBeenCalledTimes(2); // still 2 — A came from cache
  });

  it('shows an error with retry when the download fails', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    render(<AudioSummary audio={AUDIO} />);
    fireEvent.click(screen.getByRole('button', { name: /play summary/i }));

    await waitFor(() => expect(screen.getByText(/HTTP 404/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
});
