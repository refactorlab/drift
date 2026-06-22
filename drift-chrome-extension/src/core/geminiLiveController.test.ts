import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FunctionDeclaration, LiveConnectParameters, LiveServerMessage, Session } from '@google/genai';
import type { VoiceHandlers } from './voiceController';
import { encodeMicChunk } from './geminiLiveAudio';

vi.mock('./micPermission', () => ({ ensureMicPermission: vi.fn().mockResolvedValue(undefined) }));

import {
  buildLiveConfig,
  initLiveState,
  interpretLiveMessage,
  DEFAULT_GEMINI_LIVE_MODEL,
  startGeminiLive,
  type LiveEffect,
  type LiveState,
} from './geminiLiveController';

// ── helpers ─────────────────────────────────────────────────────────────────

const sc = (serverContent: LiveServerMessage['serverContent']): LiveServerMessage => ({ serverContent }) as LiveServerMessage;

/** Run a whole message script through the reducer, returning the flat effect list. */
function runScript(msgs: LiveServerMessage[]): LiveEffect[] {
  let state: LiveState = initLiveState();
  const all: LiveEffect[] = [];
  for (const m of msgs) {
    const r = interpretLiveMessage(state, m);
    state = r.state;
    all.push(...r.effects);
  }
  return all;
}

const kinds = (fx: LiveEffect[]): string[] => fx.map((f) => f.kind);
const stateArgs = (fx: LiveEffect[]): string[] => fx.filter((f) => f.kind === 'state').map((f) => (f as { state: string }).state);

// ── functional core ──────────────────────────────────────────────────────────

describe('buildLiveConfig', () => {
  it('requests audio out + transcription both ways with the persona', () => {
    expect(buildLiveConfig({ persona: 'be terse' })).toEqual({
      responseModalities: ['AUDIO'],
      systemInstruction: 'be terse',
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
  });

  it('advertises function declarations + a tool nudge when tools are provided', () => {
    const decls = [{ name: 'pr_handover_mode', description: 'd' }] as FunctionDeclaration[];
    const cfg = buildLiveConfig({ persona: 'be terse', tools: decls });
    expect(cfg.tools).toEqual([{ functionDeclarations: decls }]);
    expect(String(cfg.systemInstruction)).toContain('be terse');
    expect(String(cfg.systemInstruction)).toMatch(/tools/i);
  });

  it('omits tools (and leaves the persona untouched) when none are provided', () => {
    const cfg = buildLiveConfig({ persona: 'be terse' });
    expect(cfg.tools).toBeUndefined();
    expect(cfg.systemInstruction).toBe('be terse');
  });
});

describe('interpretLiveMessage', () => {
  const audioB64 = encodeMicChunk(new Float32Array([0.3, 0.3, 0.3, 0.3]));

  it('happy path: one user bubble, streamed tokens, audio, done→listening', () => {
    const fx = runScript([
      sc({ inputTranscription: { text: 'hi' } }),
      sc({ inputTranscription: { text: ' there', finished: true } }),
      sc({ outputTranscription: { text: 'Hel' } }),
      sc({ outputTranscription: { text: 'lo' } }),
      sc({ modelTurn: { parts: [{ inlineData: { data: audioB64 } }] } }),
      sc({ turnComplete: true }),
    ]);
    expect(kinds(fx)).toEqual(['userText', 'assistantToken', 'assistantToken', 'state', 'playAudio', 'assistantDone', 'state']);
    expect(fx.filter((f) => f.kind === 'userText')).toHaveLength(1);
    expect(fx[0]).toEqual({ kind: 'userText', text: 'hi there' });
    expect(fx.find((f) => f.kind === 'assistantDone')).toEqual({ kind: 'assistantDone', full: 'Hello', interrupted: false });
    expect(stateArgs(fx)).toEqual(['speaking', 'listening']);
  });

  it('flushes the user bubble BEFORE the assistant token within a single message', () => {
    const fx = runScript([sc({ inputTranscription: { text: 'hi', finished: true }, outputTranscription: { text: 'X' } })]);
    expect(kinds(fx)).toEqual(['userText', 'assistantToken']);
  });

  it('flushes the user bubble when the model starts even without `finished`', () => {
    const fx = runScript([sc({ inputTranscription: { text: 'hi' } }), sc({ outputTranscription: { text: 'X' } })]);
    expect(fx[0]).toEqual({ kind: 'userText', text: 'hi' });
    expect(kinds(fx)).toEqual(['userText', 'assistantToken']);
  });

  it('edge 1 — audio-only reply: no assistantToken, no empty user bubble', () => {
    const audioB64b = encodeMicChunk(new Float32Array([0.3, 0.3]));
    const fx = runScript([sc({ modelTurn: { parts: [{ inlineData: { data: audioB64b } }] } }), sc({ turnComplete: true })]);
    expect(kinds(fx)).toEqual(['state', 'playAudio', 'assistantDone', 'state']);
    expect(fx.find((f) => f.kind === 'assistantDone')).toEqual({ kind: 'assistantDone', full: '', interrupted: false });
    expect(fx.some((f) => f.kind === 'userText')).toBe(false);
    expect(fx.some((f) => f.kind === 'assistantToken')).toBe(false);
  });

  it('edge 2 — interrupted: flush + done(interrupted), trailing turnComplete is a no-op', () => {
    const fx = runScript([sc({ outputTranscription: { text: 'Hel' } }), sc({ interrupted: true }), sc({ turnComplete: true })]);
    expect(kinds(fx)).toEqual(['assistantToken', 'flushAudio', 'assistantDone', 'state']);
    expect(fx.find((f) => f.kind === 'assistantDone')).toEqual({ kind: 'assistantDone', full: 'Hel', interrupted: true });
    expect(fx.filter((f) => f.kind === 'assistantDone')).toHaveLength(1); // no double-done
  });

  it('ignores messages with no serverContent', () => {
    expect(interpretLiveMessage(initLiveState(), {} as LiveServerMessage).effects).toEqual([]);
  });

  it('flushes the user bubble on a toolCall and emits nothing else (execution is the shell’s job)', () => {
    const fx = runScript([
      sc({ inputTranscription: { text: 'go to pr handover mode' } }),
      { toolCall: { functionCalls: [{ id: 'c1', name: 'pr_handover_mode', args: {} }] } } as LiveServerMessage,
    ]);
    expect(fx).toEqual([{ kind: 'userText', text: 'go to pr handover mode' }]);
  });
});

// ── imperative shell (Web Audio + session stubbed) ─────────────────────────────

const calls: string[] = [];
const contexts: FakeAudioContext[] = [];

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeGain extends FakeNode {
  gain = { value: 1 };
}
class FakeScriptProcessor extends FakeNode {
  onaudioprocess: ((e: AudioProcessingEvent) => void) | null = null;
}
class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start = vi.fn();
  stop = vi.fn(() => calls.push('source.stop'));
  addEventListener = vi.fn();
}
class FakeAudioContext {
  sampleRate: number;
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  scriptProcessors: FakeScriptProcessor[] = [];
  bufferSources: FakeBufferSource[] = [];
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    calls.push('ctx.close');
  });
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 44_100;
    contexts.push(this);
  }
  createGain() {
    return new FakeGain();
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
  createScriptProcessor() {
    const n = new FakeScriptProcessor();
    this.scriptProcessors.push(n);
    return n;
  }
  createBufferSource() {
    const s = new FakeBufferSource();
    this.bufferSources.push(s);
    return s;
  }
  createBuffer(_ch: number, length: number) {
    return { duration: length / 24_000, getChannelData: () => new Float32Array(length) };
  }
}

function makeHandlers() {
  return {
    onUserText: vi.fn(),
    onAssistantToken: vi.fn(),
    onAssistantDone: vi.fn(),
    onState: vi.fn(),
    onLevel: vi.fn(),
    onError: vi.fn(),
  } satisfies VoiceHandlers;
}

function makeConnect() {
  const session = { sendRealtimeInput: vi.fn(), sendToolResponse: vi.fn(), close: vi.fn(() => calls.push('session.close')) };
  const connect = vi.fn(async (_params: LiveConnectParameters): Promise<Session> => session as unknown as Session);
  return { session, connect };
}

/** The callbacks the controller registered, via the captured connect params. */
function callbacksOf(connect: ReturnType<typeof makeConnect>['connect']): LiveConnectParameters['callbacks'] {
  return connect.mock.calls[0][0].callbacks;
}

describe('GeminiLiveController (shell)', () => {
  beforeEach(() => {
    calls.length = 0;
    contexts.length = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('connects once with the default model + buildLiveConfig and resumes both contexts', async () => {
    const handlers = makeHandlers();
    const { connect } = makeConnect();
    await startGeminiLive(handlers, { apiKey: 'k', persona: 'be terse', connect });

    expect(connect).toHaveBeenCalledTimes(1);
    const params = connect.mock.calls[0][0];
    expect(params.model).toBe(DEFAULT_GEMINI_LIVE_MODEL);
    expect(params.config).toEqual(buildLiveConfig({ persona: 'be terse' }));
    expect(contexts).toHaveLength(2);
    expect(contexts[0].sampleRate).toBe(16_000); // input
    expect(contexts[1].sampleRate).toBe(24_000); // output
    expect(contexts[0].resume).toHaveBeenCalled();
    expect(contexts[1].resume).toHaveBeenCalled();
    expect(handlers.onState).toHaveBeenLastCalledWith('listening');
  });

  it('honours an explicit model override', async () => {
    const { connect } = makeConnect();
    await startGeminiLive(makeHandlers(), { apiKey: 'k', persona: 'p', model: 'gemini-x-live', connect });
    expect(connect.mock.calls[0][0].model).toBe('gemini-x-live');
  });

  it('drives the handlers from a scripted server turn', async () => {
    const handlers = makeHandlers();
    const { connect } = makeConnect();
    await startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect });
    const cb = callbacksOf(connect);

    cb.onmessage(sc({ inputTranscription: { text: 'hello', finished: true } }));
    cb.onmessage(sc({ outputTranscription: { text: 'Hi ' } }));
    cb.onmessage(sc({ outputTranscription: { text: 'there' } }));
    cb.onmessage(sc({ turnComplete: true }));

    expect(handlers.onUserText).toHaveBeenCalledTimes(1);
    expect(handlers.onUserText).toHaveBeenCalledWith('hello');
    expect(handlers.onAssistantToken.mock.calls.map((c) => c[0])).toEqual(['Hi ', 'there']);
    expect(handlers.onAssistantDone).toHaveBeenCalledTimes(1);
    expect(handlers.onAssistantDone).toHaveBeenCalledWith('Hi there', false);
    expect(handlers.onState.mock.calls.map((c) => c[0])).toContain('listening');
  });

  it('feeds mic audio to the session as base64 PCM16', async () => {
    const handlers = makeHandlers();
    const { connect, session } = makeConnect();
    await startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect });
    const pump = contexts[0].scriptProcessors[0];
    expect(pump.onaudioprocess).toBeTypeOf('function');
    pump.onaudioprocess!({ inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.1, 0.2, -0.2]) } } as unknown as AudioProcessingEvent);
    expect(session.sendRealtimeInput).toHaveBeenCalledTimes(1);
    const arg = session.sendRealtimeInput.mock.calls[0][0] as { audio: { data: string; mimeType: string } };
    expect(arg.audio.mimeType).toBe('audio/pcm;rate=16000');
    expect(typeof arg.audio.data).toBe('string');
    expect(arg.audio.data.length).toBeGreaterThan(0);
  });

  it('stops scheduled playback on an interrupt', async () => {
    const handlers = makeHandlers();
    const { connect } = makeConnect();
    await startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect });
    const cb = callbacksOf(connect);
    const audioB64 = encodeMicChunk(new Float32Array([0.5, 0.5, 0.5, 0.5]));

    cb.onmessage(sc({ modelTurn: { parts: [{ inlineData: { data: audioB64 } }] } }));
    expect(contexts[1].bufferSources).toHaveLength(1);
    cb.onmessage(sc({ interrupted: true }));
    expect(contexts[1].bufferSources[0].stop).toHaveBeenCalled();
    expect(handlers.onAssistantDone).toHaveBeenCalledWith('', true);
  });

  it('stop() closes the session before the contexts and is idempotent', async () => {
    const handlers = makeHandlers();
    const { connect, session } = makeConnect();
    const vc = await startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect });

    await vc.stop();
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(calls.indexOf('session.close')).toBeLessThan(calls.indexOf('ctx.close'));
    expect(handlers.onState).toHaveBeenLastCalledWith('idle');

    await vc.stop(); // idempotent
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('reconnects with the new persona on resetConversation', async () => {
    const { connect, session } = makeConnect();
    const vc = await startGeminiLive(makeHandlers(), { apiKey: 'k', persona: 'old', connect });
    vc.resetConversation('new persona');
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
    expect(session.close).toHaveBeenCalled();
    expect(connect.mock.calls[1][0].config?.systemInstruction).toBe('new persona');
  });

  it('rejects start() (and cleans up) when connect fails', async () => {
    const handlers = makeHandlers();
    const connect = vi.fn(async (): Promise<Session> => {
      throw new Error('socket refused');
    });
    await expect(startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect })).rejects.toThrow('socket refused');
    expect(contexts.every((c) => c.close.mock.calls.length > 0)).toBe(true);
  });

  it('advertises tools and runs a Gemini tool call through the bridge → sendToolResponse', async () => {
    const handlers = makeHandlers();
    const { connect, session } = makeConnect();
    const execute = vi.fn().mockResolvedValue({ ok: true, content: 'full walkthrough', spoken: 'short narration' });
    const toolBridge = { declarations: [{ name: 'pr_handover_mode', description: 'd' }] as FunctionDeclaration[], execute };
    await startGeminiLive(handlers, { apiKey: 'k', persona: 'p', connect, toolBridge });

    // declarations reach the connect config
    expect(connect.mock.calls[0][0].config?.tools).toEqual([{ functionDeclarations: toolBridge.declarations }]);

    const cb = callbacksOf(connect);
    cb.onmessage(sc({ inputTranscription: { text: 'go to pr handover mode', finished: true } }));
    cb.onmessage({ toolCall: { functionCalls: [{ id: 'c1', name: 'pr_handover_mode', args: {} }] } } as LiveServerMessage);

    await vi.waitFor(() => expect(session.sendToolResponse).toHaveBeenCalled());
    expect(handlers.onUserText).toHaveBeenCalledWith('go to pr handover mode');
    expect(execute).toHaveBeenCalledWith('pr_handover_mode', {}, expect.anything());
    expect(session.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [{ id: 'c1', name: 'pr_handover_mode', response: { output: 'short narration' } }],
    });
  });
});
