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

const fakeRuntime: KokoroRuntime = {
  async synthesize() {
    return { samples: new Float32Array(2400), sampleRate: 24000 };
  },
  free() {},
};

describe('SpokenSummary — engine selection + gate', () => {
  beforeEach(() => {
    installChromeMock();
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

  it('renders nothing when the spoken summary is disabled in settings', async () => {
    await patchSettings({ ttsEnabled: false });
    loadKokoroRuntime.mockResolvedValue(fakeRuntime);
    const { container } = render(<SpokenSummary text="A short narration." />);
    await waitFor(() => expect(container.querySelector('.spoken-card')).toBeNull());
    expect(screen.queryByText('Spoken summary')).toBeNull();
  });
});
