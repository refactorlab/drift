// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scanInWorker } from './scanWorkerClient';
import type { ScanWorkerRequest, ScanWorkerMessage } from './scanWorker';

// Stub the Worker so we can assert the main-thread half WITHOUT a real thread:
// it must transfer the zip + forward diffStatus in the posted request, and
// resolve the parsed JSON from a `done` message.
class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((e: MessageEvent<ScanWorkerMessage>) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  posted: { req: ScanWorkerRequest; transfer?: Transferable[] }[] = [];
  terminated = false;
  constructor(_url: URL, _opts?: unknown) {
    FakeWorker.last = this;
  }
  postMessage(req: ScanWorkerRequest, transfer?: Transferable[]) {
    this.posted.push({ req, transfer });
  }
  terminate() {
    this.terminated = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('scanInWorker — main-thread driver round-trip', () => {
  it('forwards diffStatus + transfers the zip, then resolves the parsed JSON', async () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);

    const zip = new Uint8Array([1, 2, 3, 4]);
    const promise = scanInWorker(zip, {} as WebAssembly.Module, {
      changedFiles: ['a.py'],
      diffStatus: 'M\ta.py\nD\tb.py',
    });

    const w = FakeWorker.last!;
    expect(w.posted).toHaveLength(1);
    // diffStatus made it into the request the worker receives…
    expect(w.posted[0].req.inputs.diffStatus).toBe('M\ta.py\nD\tb.py');
    // …and the zip buffer was handed over as a transferable (zero-copy).
    expect(w.posted[0].transfer?.length).toBe(1);

    // Worker replies with a done message carrying the JSON result bytes.
    const out = new TextEncoder().encode('{"schema_version":"1.0"}').buffer;
    w.onmessage!({ data: { type: 'done', out } } as MessageEvent<ScanWorkerMessage>);

    await expect(promise).resolves.toEqual({ schema_version: '1.0' });
    expect(w.terminated).toBe(true); // single-shot worker torn down
  });

  it('rejects when the worker posts an error', async () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    const promise = scanInWorker(new Uint8Array([1]), {} as WebAssembly.Module, { changedFiles: [] });
    FakeWorker.last!.onmessage!({
      data: { type: 'error', message: 'scan blew up' },
    } as MessageEvent<ScanWorkerMessage>);
    await expect(promise).rejects.toThrow('scan blew up');
  });
});
