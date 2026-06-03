// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { runWithDiffStatusFallback } from './wasi';

const OK = new Uint8Array([1, 2, 3]);
const exit = (code: number) => Object.assign(new Error(`scan-pr exited with code ${code}`), { code });

describe('runWithDiffStatusFallback — graceful degrade for an old scanner', () => {
  it('runs WITHOUT diff-status when there is none (single attempt)', async () => {
    const attempt = vi.fn().mockResolvedValue(OK);
    const out = await runWithDiffStatusFallback(attempt, false, () => {});
    expect(out).toBe(OK);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(false);
  });

  it('uses diff-status when supported (no retry, no log)', async () => {
    const attempt = vi.fn().mockResolvedValue(OK);
    const log = vi.fn();
    const out = await runWithDiffStatusFallback(attempt, true, log);
    expect(out).toBe(OK);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('retries WITHOUT diff-status when the scanner rejects the flag (clap exit 2)', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(exit(2)) // old wasm: unknown --diff-status
      .mockResolvedValueOnce(OK); // succeeds without it
    const log = vi.fn();
    const out = await runWithDiffStatusFallback(attempt, true, log);
    expect(out).toBe(OK);
    expect(attempt.mock.calls).toEqual([[true], [false]]); // tried with, then without
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/predates --diff-status/));
  });

  it('does NOT retry on a real scan failure (exit 1) — propagates', async () => {
    const attempt = vi.fn().mockRejectedValue(exit(1));
    await expect(runWithDiffStatusFallback(attempt, true, () => {})).rejects.toThrow(/code 1/);
    expect(attempt).toHaveBeenCalledTimes(1); // no fallback for a genuine error
  });
});
