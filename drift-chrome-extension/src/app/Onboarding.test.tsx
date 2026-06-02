import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { installChromeMock } from '../test/chromeMock';
import { Onboarding } from './Onboarding';

// Onboarding's "Get started" runs a setup checklist: it acquires the REQUIRED
// scan engine (with progress) and the OPTIONAL voice engine, then unlocks
// "Continue" once the required engine settles. We mock both acquirers so the
// tests exercise the flow, not the wasm.
const ensureScanner = vi.fn();
const prewarmScanner = vi.fn();
const ensureTts = vi.fn();
vi.mock('../core/scannerStore', () => ({
  ensureScanner: (...a: unknown[]) => ensureScanner(...a),
  prewarmScanner: (...a: unknown[]) => prewarmScanner(...a),
}));
vi.mock('../core/ttsStore', () => ({
  ensureTts: (...a: unknown[]) => ensureTts(...a),
}));

const scannerOk = { status: 'acquired', meta: { version: '0.8.0', bytes: 22 * 1024 * 1024 } };
const voiceOk = { status: 'ready', meta: { version: 'kokoro-v1', bytes: 80 * 1024 * 1024 } };

describe('Onboarding — first-install setup checklist', () => {
  beforeEach(() => {
    installChromeMock(); // getSettings() reads ttsEnabled (default: on)
    ensureScanner.mockReset();
    prewarmScanner.mockReset();
    ensureTts.mockReset();
  });
  afterEach(() => cleanup());

  it('acquires the scanner (with progress) and unlocks Continue → onDone', async () => {
    ensureScanner.mockImplementation(async (onProgress?: (p: { phase: string }) => void) => {
      onProgress?.({ phase: 'Downloading scanner v0.8.0…' });
      return scannerOk;
    });
    ensureTts.mockResolvedValue(voiceOk);
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Get started'));
    });

    // Required engine settled → the primary button reflects success and works.
    await waitFor(() => expect(screen.getByText('Start using Drift')).toBeTruthy());
    expect(ensureScanner).toHaveBeenCalledOnce();
    expect(typeof ensureScanner.mock.calls[0][0]).toBe('function'); // got a progress cb
    expect(prewarmScanner).toHaveBeenCalled(); // background compile kicked off

    fireEvent.click(screen.getByText('Start using Drift'));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('fails the OPTIONAL voice soft — never blocks Continue', async () => {
    ensureScanner.mockResolvedValue(scannerOk);
    ensureTts.mockRejectedValue(new Error('engine not staged'));
    render(<Onboarding onDone={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Get started'));
    });

    // Scanner succeeded → Continue is the success label despite the voice failing.
    await waitFor(() => expect(screen.getByText('Start using Drift')).toBeTruthy());
    // The model isn't downloaded here (that's a Settings action) → soft skip note.
    await waitFor(() => expect(screen.getByText(/Download in Settings/i)).toBeTruthy());
  });

  it('on scanner failure: offers Continue anyway + a Retry', async () => {
    ensureScanner.mockRejectedValue(new Error('offline'));
    ensureTts.mockResolvedValue(voiceOk);
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Get started'));
    });

    await waitFor(() => expect(screen.getByText('Continue anyway')).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();

    fireEvent.click(screen.getByText('Continue anyway'));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
