/// <reference lib="webworker" />
// Off-main-thread LLM inference — the brain counterpart of ttsWorker.ts. WebLLM
// loads Qwen (~1.1 GB) and runs token generation on WebGPU; both are heavy and
// must stay off the page so the side panel keeps painting. The worker is
// PERSISTENT: the model loads once on `init`, then every `generate` reuses it.
//
// chrome.* is unavailable in a worker, so nothing extension-specific is needed
// here — WebLLM fetches the model from the MLC CDN and caches it in IndexedDB
// (first load downloads, later loads are an offline cache hit). MV3's
// no-remote-CODE rule is about executable script, not model DATA — same contract
// as ttsWorker fetching the Kokoro model from the Hub.

import { BRAIN_MODEL_ID, MAX_OUTPUT_TOKENS } from './brainConstants';
import { logger } from './debug';
import type { ChatTurn } from './chatContext';

const log = logger('brain');

/** A stringified JSON schema for grammar-constrained (XGrammar) output. */
export type BrainResponseFormat = { type: 'json_object'; schema: string } | { type: 'grammar'; grammar: string };

export type BrainWorkerInit = { type: 'init'; model?: string };
export type BrainWorkerGenerate = {
  type: 'generate';
  id: number;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
};
/** Non-streaming completion, optionally grammar-constrained. Used by the agent
 *  loop's tool ROUTER (response_format guarantees a valid, enum-locked decision). */
export type BrainWorkerComplete = {
  type: 'complete';
  id: number;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: BrainResponseFormat;
};
export type BrainWorkerInterrupt = { type: 'interrupt' };
export type BrainWorkerRequest =
  | BrainWorkerInit
  | BrainWorkerGenerate
  | BrainWorkerComplete
  | BrainWorkerInterrupt;

export type BrainWorkerMessage =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  /** Model-download/compile progress, emitted during init (first load only). */
  | { type: 'progress'; phase: string; fraction: number | null }
  /** One streamed token (delta text) for generation `id`. */
  | { type: 'token'; id: number; text: string }
  /** Generation `id` finished; `text` is the full reply (may be empty if interrupted). */
  | { type: 'done'; id: number; text: string }
  | { type: 'gen-error'; id: number; message: string };

const post = (msg: BrainWorkerMessage) => (self as unknown as Worker).postMessage(msg);

/** Minimal structural type for the WebLLM engine surface we use (avoids a hard
 *  type dep on @mlc-ai/web-llm in the worker bundle). */
type Engine = {
  chat: {
    completions: {
      create: ((req: {
        messages: ChatTurn[];
        stream: true;
        temperature?: number;
        max_tokens?: number;
      }) => Promise<AsyncIterable<{ choices: Array<{ delta?: { content?: string } }> }>>) &
        ((req: {
          messages: ChatTurn[];
          stream?: false;
          temperature?: number;
          max_tokens?: number;
          response_format?: BrainResponseFormat;
        }) => Promise<{ choices: Array<{ message?: { content?: string } }> }>);
    };
  };
  interruptGenerate: () => void;
};

let enginePromise: Promise<Engine> | null = null;

async function init(msg: BrainWorkerInit): Promise<Engine> {
  const webllm = await import('@mlc-ai/web-llm');
  const model = msg.model || BRAIN_MODEL_ID;
  const engine = await webllm.CreateMLCEngine(model, {
    initProgressCallback: (p: { progress?: number; text?: string }) => {
      post({
        type: 'progress',
        phase: p.text || 'Loading model…',
        fraction: typeof p.progress === 'number' ? Math.max(0, Math.min(1, p.progress)) : null,
      });
    },
  });
  return engine as unknown as Engine;
}

self.onmessage = async (e: MessageEvent<BrainWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      enginePromise = init(msg);
      await enginePromise;
      log.log('model ready');
      post({ type: 'ready' });
    } catch (err) {
      enginePromise = null;
      log.error('init failed', err);
      post({ type: 'init-error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (msg.type === 'interrupt') {
    // Best-effort: ask WebLLM to stop. The in-flight generate loop keeps draining
    // to EOF (the lock releases only at end-of-stream) and reports `done`.
    try {
      const engine = enginePromise ? await enginePromise : null;
      engine?.interruptGenerate();
    } catch {
      /* ignore — nothing to interrupt */
    }
    return;
  }

  if (msg.type === 'complete') {
    // Non-streaming, optionally grammar-constrained. The router uses this to get
    // a guaranteed-valid JSON decision; the result rides back on `done`.
    const stop = log.time(`complete#${msg.id}${msg.responseFormat ? ' (constrained)' : ''}`);
    try {
      if (!enginePromise) throw new Error('brain worker not initialised');
      const engine = await enginePromise;
      const res = await engine.chat.completions.create({
        messages: msg.messages,
        stream: false,
        temperature: msg.temperature ?? 0,
        max_tokens: Math.min(msg.maxTokens ?? 64, MAX_OUTPUT_TOKENS),
        response_format: msg.responseFormat,
      });
      const text = res.choices?.[0]?.message?.content ?? '';
      stop();
      log.log(`complete#${msg.id} → ${text.trim().slice(0, 80)}`);
      post({ type: 'done', id: msg.id, text });
    } catch (err) {
      log.warn(`complete#${msg.id} failed`, err);
      post({ type: 'gen-error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // generate
  try {
    if (!enginePromise) throw new Error('brain worker not initialised');
    const engine = await enginePromise;
    const stream = await engine.chat.completions.create({
      messages: msg.messages,
      stream: true,
      // Let the MODEL's compiled ChatConfig pick sampling unless the caller set a
      // value (matches Volley — it never coerces an undefined temperature to a
      // default; hard-coding 0.7 silently overrode the model's tuned sampling).
      ...(typeof msg.temperature === 'number' ? { temperature: msg.temperature } : {}),
      // Cap reply length when running locally (see MAX_OUTPUT_TOKENS). A caller
      // may pass a smaller maxTokens, but never exceed the local cap.
      max_tokens: Math.min(msg.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    });
    const stop = log.time(`generate#${msg.id}`);
    let full = '';
    let n = 0;
    for await (const chunk of stream) {
      const tok = chunk.choices?.[0]?.delta?.content;
      if (tok) {
        full += tok;
        n++;
        post({ type: 'token', id: msg.id, text: tok });
      }
    }
    stop();
    log.log(`generate#${msg.id} → ${n} tokens, ${full.length} chars`);
    post({ type: 'done', id: msg.id, text: full });
  } catch (err) {
    log.warn(`generate#${msg.id} failed`, err);
    post({ type: 'gen-error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
