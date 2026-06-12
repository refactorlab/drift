import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { Chat } from './Chat';
import { emptyReport, type PrContext } from '../core/types';

const URL70 = 'https://github.com/o/r/pull/70';
const SETTINGS = { onboarded: true, askBeforeActing: true, theme: 'light' as const };
const noop = () => {};

function contextWithAudio(): PrContext {
  return {
    pr: { owner: 'o', repo: 'r', number: 70, title: 'Title', url: URL70 },
    report: { ...emptyReport(), found: true, verdictLabel: 'Address before merge' },
    artifacts: [{ name: 'pr-scan.json', url: `${URL70}#a`, kind: 'scan-report' }],
    audio: { url: `${URL70}#audio`, label: '🔊 Listen to the spoken summary (Piper TTS)' },
    detectedAt: 0,
  };
}

describe('Chat — spoken-summary audio (end-to-end)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('renders a playable audio card once a PR with audio is detected', async () => {
    mock.setContext(contextWithAudio());
    render(<Chat settings={SETTINGS} onOpenSettings={noop} onOpenContext={noop} onOpenPipeline={noop} onOpenVoice={noop} />);

    // The card appears (the reasoning turn pushes messages.length > 0).
    const play = await waitFor(
      () => screen.getByRole('button', { name: /play summary/i }),
      { timeout: 3000 },
    );
    expect(screen.getByText(/spoken summary/i)).toBeTruthy();

    // Playing it downloads the audio (binary FETCH_ARTIFACT) and reveals <audio>.
    let askedBinary = false;
    mock.setResponder((msg) => {
      const m = msg as { type?: string; binary?: boolean };
      if (m.type === 'FETCH_ARTIFACT') {
        askedBinary = m.binary === true;
        return { ok: true, fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 9 } };
      }
      return { ok: true };
    });
    fireEvent.click(play);

    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toBe('data:audio/mpeg;base64,AAAA');
    });
    expect(askedBinary).toBe(true);
  });

  it('shows no audio card when the detected PR has no spoken summary', async () => {
    const noAudio = contextWithAudio();
    delete (noAudio as { audio?: unknown }).audio;
    mock.setContext(noAudio);
    render(<Chat settings={SETTINGS} onOpenSettings={noop} onOpenContext={noop} onOpenPipeline={noop} onOpenVoice={noop} />);

    await waitFor(() => expect(screen.getByText(/Recognised a Drift scan/i)).toBeTruthy(), {
      timeout: 3000,
    });
    expect(screen.queryByRole('button', { name: /play summary/i })).toBeNull();
  });
});
