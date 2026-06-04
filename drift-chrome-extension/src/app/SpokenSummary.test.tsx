import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock } from '../test/chromeMock';
import { patchSettings } from '../state/settings';
import type { KokoroRuntime } from '../core/kokoroRuntime';

// The live-scan spoken summary prefers the in-tab Kokoro engine and falls back
// to the browser voice. We mock the engine LOADER (ttsStore) so the component's
// engine-selection + playback wiring is exercised without the real model.
const loadKokoroRuntime = vi.fn();
const isTtsAvailable = vi.fn();
vi.mock('../core/ttsStore', () => ({
  loadKokoroRuntime: (...a: unknown[]) => loadKokoroRuntime(...a),
  isTtsAvailable: (...a: unknown[]) => isTtsAvailable(...a),
}));

import { SpokenSummary } from './SpokenSummary';
import { __resetSharedTtsProvider } from '../core/ttsEngine';
import { saveSpokenAudio, getSpokenAudio } from '../state/spokenAudio';

const fakeRuntime: KokoroRuntime = {
  async synthesize() {
    return { samples: new Float32Array(2400), sampleRate: 24000 };
  },
  free() {},
};

describe('SpokenSummary — engine selection + gate', () => {
  beforeEach(() => {
    installChromeMock();
    // The Kokoro engine is now an app-wide singleton (ttsEngine). Drop it so each
    // test builds a fresh provider against THIS test's mocked loader — otherwise a
    // runtime cached by an earlier test would mask later mockReset()s.
    __resetSharedTtsProvider();
    loadKokoroRuntime.mockReset();
    isTtsAvailable.mockReset();
    // jsdom implements neither media playback nor object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:fake') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {}) as unknown as HTMLMediaElement['play'];
    window.HTMLMediaElement.prototype.pause = vi.fn(() => {}) as unknown as HTMLMediaElement['pause'];
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses Kokoro when the engine loads, and synthesizes on Listen', async () => {
    isTtsAvailable.mockResolvedValue(true);
    loadKokoroRuntime.mockResolvedValue(fakeRuntime);
    render(<SpokenSummary text="A short narration." />);

    // Engine resolves to Kokoro → its tag + the Listen control appear.
    await waitFor(() => expect(screen.getByText(/Kokoro · on-device/)).toBeTruthy());
    // LAZY: the ~80–300 MB model must NOT load just to offer the button — only
    // the cheap reachability probe ran so far.
    expect(loadKokoroRuntime).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('▶ Listen'));

    // Synthesis completes → playback starts (Pause is now offered).
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());
    expect(loadKokoroRuntime).toHaveBeenCalledOnce();
  });

  it('hands a lazily-synthesized clip to onSynthesized so the parent can cache it', async () => {
    // The cache-back contract: when this component synthesizes a clip on the lazy
    // path (a replayed scan whose WAV was never persisted), it must surface the
    // finished WAV so the parent can save it — making the NEXT replay instant.
    isTtsAvailable.mockResolvedValue(true);
    loadKokoroRuntime.mockResolvedValue(fakeRuntime);
    const onSynthesized = vi.fn();
    render(<SpokenSummary text="A short narration." onSynthesized={onSynthesized} />);

    await waitFor(() => expect(screen.getByText('▶ Listen')).toBeTruthy());
    expect(onSynthesized).not.toHaveBeenCalled(); // nothing synthesized just to offer the button

    fireEvent.click(screen.getByText('▶ Listen'));
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());

    // Fired once, with a real WAV + the voice + duration the parent persists.
    expect(onSynthesized).toHaveBeenCalledTimes(1);
    const clip = onSynthesized.mock.calls[0][0] as { wav: Uint8Array; voice: string; durationSeconds: number };
    expect(clip.wav).toBeInstanceOf(Uint8Array);
    expect(clip.wav.length).toBeGreaterThan(0);
    expect(typeof clip.voice).toBe('string');
    expect(clip.durationSeconds).toBeGreaterThan(0);
  });

  it('does NOT notify onSynthesized when playing pipeline-prepared audio (nothing was synthesized)', async () => {
    // Prepared audio is already cached by the pipeline — re-persisting it would be
    // wasteful, so the callback must stay silent on the instant path.
    const onSynthesized = vi.fn();
    const prepared = { wav: new Uint8Array([1, 2, 3, 4]), voice: 'af_heart', durationSeconds: 12.5 };
    render(<SpokenSummary text="A short narration." prepared={prepared} onSynthesized={onSynthesized} />);

    await waitFor(() => expect(screen.getByText('▶ Listen')).toBeTruthy());
    fireEvent.click(screen.getByText('▶ Listen'));
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());
    expect(onSynthesized).not.toHaveBeenCalled();
    expect(loadKokoroRuntime).not.toHaveBeenCalled();
  });

  it('falls back to the system voice when the Kokoro engine is unavailable', async () => {
    isTtsAvailable.mockResolvedValue(false);
    // Minimal Web Speech stub so the fallback engine is available.
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [],
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    render(<SpokenSummary text="A short narration." />);
    await waitFor(() => expect(screen.getByText(/system voice · fallback/)).toBeTruthy());
  });

  it('plays pipeline-prepared audio instantly — no probe, no model load', async () => {
    // The pipeline synthesized the WAV ahead of time and handed it down. The
    // component must NOT probe the engine or load the model; the first press
    // plays the armed blob.
    const prepared = {
      wav: new Uint8Array([1, 2, 3, 4]),
      voice: 'af_heart',
      durationSeconds: 12.5,
    };
    render(<SpokenSummary text="A short narration." prepared={prepared} />);

    // Kokoro tag with the prepared voice + duration appears immediately.
    await waitFor(() => expect(screen.getByText(/Kokoro · on-device/)).toBeTruthy());
    expect(screen.getByText(/af_heart/)).toBeTruthy();
    // No cheap probe and no model load were needed for prepared audio.
    expect(isTtsAvailable).not.toHaveBeenCalled();
    expect(loadKokoroRuntime).not.toHaveBeenCalled();
    // A blob was armed from the prepared WAV.
    expect(URL.createObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByText('▶ Listen'));
    // Plays straight away — straight to Pause, never the "Synthesizing" state.
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());
    expect(loadKokoroRuntime).not.toHaveBeenCalled();
  });

  it('REGRESSION — a REPLAYED scan plays its persisted audio, never re-synthesizing', async () => {
    // This is the user-reported bug: pressing Listen on a past scan showed
    // "… Synthesizing" even though the scan already produced the audio. Exercise
    // the FULL replay chain through real chrome.storage: the scan persists its
    // WAV (saveSpokenAudio), the replay loads it (getSpokenAudio) and hands it to
    // SpokenSummary — which must play it instantly with NO model work.
    isTtsAvailable.mockResolvedValue(true);
    loadKokoroRuntime.mockResolvedValue(fakeRuntime);

    const recordId = 'https://github.com/acme/web/pull/1@deadbeef@1718000000000';
    await saveSpokenAudio(recordId, {
      wav: new Uint8Array([82, 73, 70, 70, 1, 2, 3, 255, 0, 128]), // "RIFF"… real bytes
      voice: 'af_heart',
      durationSeconds: 18.2,
    });

    // The replay path (openRecord) loads the persisted clip from storage.
    const replayed = await getSpokenAudio(recordId);
    expect(replayed).not.toBeNull();

    render(<SpokenSummary text="A short narration." prepared={replayed} />);

    await waitFor(() => expect(screen.getByText(/Kokoro · on-device/)).toBeTruthy());
    // The persisted voice + duration surfaced — proof the stored metadata survived.
    expect(screen.getByText(/af_heart/)).toBeTruthy();
    // No probe, no model load: prepared audio short-circuits both.
    expect(isTtsAvailable).not.toHaveBeenCalled();
    expect(loadKokoroRuntime).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('▶ Listen'));
    // Straight to playback — never the "… Synthesizing" state the bug showed.
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());
    expect(screen.queryByText('… Synthesizing')).toBeNull();
    expect(loadKokoroRuntime).not.toHaveBeenCalled();
  });

  it('renders nothing when the spoken summary is disabled in settings', async () => {
    await patchSettings({ ttsEnabled: false });
    loadKokoroRuntime.mockResolvedValue(fakeRuntime);
    const { container } = render(<SpokenSummary text="A short narration." />);
    await waitFor(() => expect(container.querySelector('.spoken-card')).toBeNull());
    expect(screen.queryByText('Spoken summary')).toBeNull();
  });
});
