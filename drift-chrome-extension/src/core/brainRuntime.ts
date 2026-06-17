// The in-tab LLM brain seam — the chat counterpart of kokoroRuntime.ts. Spawns
// the persistent inference worker (brainWorker.ts), waits until WebLLM has the
// model loaded, and exposes a streaming `generate`. Mirrors the Kokoro factory
// so it's injectable for tests (a fake RuntimeFactory) and fails soft.

import type {
  BrainWorkerInit,
  BrainWorkerGenerate,
  BrainWorkerComplete,
  BrainWorkerMessage,
  BrainResponseFormat,
} from './brainWorker';
import type { ChatTurn } from './chatContext';

/** Model-load progress, forwarded from the worker's WebLLM download/compile callback. */
export type BrainProgress = { phase: string; fraction: number | null };

export interface GenerateOptions {
  /** Called for each streamed token (delta text). */
  onToken?: (text: string) => void;
  /** Abort this generation (interrupts WebLLM; the promise still resolves with
   *  whatever was produced so far). */
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  /** Grammar-constrained output (XGrammar). The tool router passes a JSON schema
   *  so the decision is guaranteed valid + enum-locked to available tools. */
  responseFormat?: BrainResponseFormat;
}

/** A loaded, ready-to-generate brain. */
export interface BrainRuntime {
  /** Stream a completion for `messages`; resolves with the full reply text. */
  generate(messages: ChatTurn[], opts?: GenerateOptions): Promise<string>;
  /** Non-streaming completion (optionally grammar-constrained). For the router. */
  complete(messages: ChatTurn[], opts?: CompleteOptions): Promise<string>;
  /** Best-effort stop of any in-flight generation. */
  interrupt(): void;
  /** Release the engine — terminates the worker thread. */
  free(): void;
}

/** Builds a runtime. Injected so tests use a fake; production spawns the worker.
 *  `onProgress` streams the model DOWNLOAD (first load fetches ~1.1 GB, then
 *  IndexedDB serves it offline). */
export type BrainFactory = (onProgress?: (p: BrainProgress) => void) => Promise<BrainRuntime>;

/**
 * Default factory: spawn the inference worker, hand it the init message, and
 * wait until WebLLM has loaded the model. Defensive — an init/generate failure
 * rejects/settles so the caller treats it as "brain unavailable".
 */
export const defaultBrainFactory: BrainFactory = async (onProgress) => {
  const worker = new Worker(new URL('./brainWorker.ts', import.meta.url), { type: 'module' });

  // Block on first model load so the first generate reflects reality. First load
  // DOWNLOADS the model (then IndexedDB serves it) — progress → onProgress.
  await new Promise<void>((resolve, reject) => {
    const onInit = (e: MessageEvent<BrainWorkerMessage>) => {
      if (e.data.type === 'progress') {
        onProgress?.({ phase: e.data.phase, fraction: e.data.fraction });
      } else if (e.data.type === 'ready') {
        worker.removeEventListener('message', onInit);
        resolve();
      } else if (e.data.type === 'init-error') {
        worker.removeEventListener('message', onInit);
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', onInit);
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'brain worker crashed during init'));
    };
    worker.postMessage({ type: 'init' } satisfies BrainWorkerInit);
  });

  // Init resolved; repurpose onerror to fail in-flight generations soft.
  let seq = 0;
  const pending = new Map<number, (err: Error) => void>();
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'brain worker crashed during generation');
    for (const reject of pending.values()) reject(err);
    pending.clear();
  };

  return {
    generate(messages, opts = {}) {
      const id = ++seq;
      return new Promise<string>((resolve, reject) => {
        pending.set(id, reject);
        const onAbort = () => worker.postMessage({ type: 'interrupt' });
        const settle = () => {
          worker.removeEventListener('message', onMsg);
          opts.signal?.removeEventListener('abort', onAbort);
          pending.delete(id);
        };
        const onMsg = (e: MessageEvent<BrainWorkerMessage>) => {
          const m = e.data;
          if (m.type === 'token' && m.id === id) {
            opts.onToken?.(m.text);
          } else if (m.type === 'done' && m.id === id) {
            settle();
            resolve(m.text);
          } else if (m.type === 'gen-error' && m.id === id) {
            settle();
            reject(new Error(m.message));
          }
        };
        worker.addEventListener('message', onMsg);
        if (opts.signal) {
          if (opts.signal.aborted) onAbort();
          else opts.signal.addEventListener('abort', onAbort);
        }
        worker.postMessage({
          type: 'generate',
          id,
          messages,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
        } satisfies BrainWorkerGenerate);
      });
    },
    complete(messages, opts = {}) {
      const id = ++seq;
      return new Promise<string>((resolve, reject) => {
        pending.set(id, reject);
        const onAbort = () => worker.postMessage({ type: 'interrupt' });
        const settle = () => {
          worker.removeEventListener('message', onMsg);
          opts.signal?.removeEventListener('abort', onAbort);
          pending.delete(id);
        };
        const onMsg = (e: MessageEvent<BrainWorkerMessage>) => {
          const m = e.data;
          if (m.type === 'done' && m.id === id) {
            settle();
            resolve(m.text);
          } else if (m.type === 'gen-error' && m.id === id) {
            settle();
            reject(new Error(m.message));
          }
        };
        worker.addEventListener('message', onMsg);
        if (opts.signal) {
          if (opts.signal.aborted) onAbort();
          else opts.signal.addEventListener('abort', onAbort);
        }
        worker.postMessage({
          type: 'complete',
          id,
          messages,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          responseFormat: opts.responseFormat,
        } satisfies BrainWorkerComplete);
      });
    },
    interrupt() {
      worker.postMessage({ type: 'interrupt' });
    },
    free() {
      worker.terminate();
    },
  };
};

/** Can the brain RUN here? WebLLM needs WebGPU. Never throws. */
export async function isBrainSupported(): Promise<boolean> {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu;
}
