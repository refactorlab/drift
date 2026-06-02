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

  it('shows an error with retry when the download fails', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    render(<AudioSummary audio={AUDIO} />);
    fireEvent.click(screen.getByRole('button', { name: /play summary/i }));

    await waitFor(() => expect(screen.getByText(/HTTP 404/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
});
