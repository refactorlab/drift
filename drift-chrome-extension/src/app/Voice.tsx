import { useEffect, useRef, useState } from 'react';
import { patchSettings, type Settings } from '../state/settings';
import { usePrContext } from '../state/prContext';
import { VoiceIO } from '../core/voiceAudio';
import { transcribe, synthesize, hasCfCreds, isNoiseTranscript, DEFAULT_SPEAKER, type CfCreds } from '../core/cfVoice';
import {
  streamBrain,
  pingBrain,
  uploadBrainContext,
  DEFAULT_BRAIN_URL,
  DEFAULT_VOICE_MODEL,
  VOICE_MODELS,
  voiceModelLabel,
  type BrainTurn,
  type BrainMeta,
} from '../core/voiceBrain';
import { buildVoiceSystemPrompt } from '../core/voicePrompt';
import { takeSentences } from '../core/sentenceStream';
import { VoiceModeTabs } from './VoiceModeTabs';
import {
  permissionUrl,
  openPermissionTab,
  isMicPermissionError,
  queryMicPermission,
  MIC_GRANT_MESSAGE,
  type MicGrantMessage,
} from '../state/micPermission';

// Stateless context window: the last N messages sent to the brain each turn. The
// brain holds NO session — this transcript is the whole context, so capping it
// bounds latency + token cost and is the standard chat-completions pattern. (Why
// stateless: aborting a resumed session on barge-in corrupts it and drops context.)
const MAX_HISTORY = 10;

type Status = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
interface Turn {
  role: 'user' | 'assistant';
  text: string;
  // Per-turn step timings (assistant turns only) — see the breakdown under the bubble.
  sttMs?: number; // speech-to-text (Cloudflare Whisper)
  ms?: number; // wall-clock the Claude CLI took to answer
  ttftMs?: number; // Claude time to first token
  ttsMs?: number; // text-to-speech synthesis (summed across the turn's sentences)
  model?: string; // the Claude model id that answered this turn
  // Token usage from the brain. inTok is the full prompt reprocessed this turn
  // (replayed session + diff system prompt); cacheTok is how much of it hit the cache.
  inTok?: number; // fresh (uncached) input tokens prefilled this turn
  outTok?: number; // tokens generated this turn
  cacheTok?: number; // input tokens served from the prompt cache
}

// Compact token count: "820" under 1k, "3.4k" above.
function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;
}

// Compact duration label: "480ms" under a second, "2.3s" above.
function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

// "claude-opus-4-8" → "Opus 4.8" (drop the "· most capable" descriptor).
function shortModel(id: string | undefined): string {
  if (!id) return 'Claude';
  return (voiceModelLabel(id).split('·')[0] ?? id).trim();
}

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Off',
  listening: '● Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Andy is thinking…',
  speaking: 'Andy is speaking…',
};

// The LIVE voice agent. Tap "Start" once and just talk — a continuous energy-VAD
// (in core/voiceAudio.ts) detects each utterance, transcribes it on Cloudflare,
// streams a grounded reply from the local drift-brain (Claude), and speaks it
// back. No per-turn button; talk over Andy to barge in.
export function Voice({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const { ctx } = usePrContext();
  const [status, setStatus] = useState<Status>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brainOk, setBrainOk] = useState<boolean | null>(null);
  const [micNeedsGrant, setMicNeedsGrant] = useState(false);

  const io = useRef<VoiceIO | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversing = useRef(false);
  // Serializes turns: each utterance chains after the previous one's full unwind, so a
  // barge-in preempts cleanly instead of racing teardown — and is never dropped.
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  // Live settings ref so a config change mid-conversation (e.g. switching the model)
  // takes effect on the NEXT turn instead of being captured stale by the turn closures.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const scrollRef = useRef<HTMLDivElement>(null);
  const youOrb = useRef<HTMLDivElement>(null);
  const aiOrb = useRef<HTMLDivElement>(null);
  // Latest startConversation, so the grant-iframe message listener (registered once)
  // always retries with current settings rather than a stale closure.
  const startRef = useRef<() => void>(() => {});
  // The brain workspace holding THIS PR's full diff (uploaded once). Passed on every
  // turn so Andy can Read any file on demand for questions the inline excerpt can't
  // answer; null until the upload lands (turns just fall back to inline grounding).
  const workspaceIdRef = useRef<string | null>(null);

  const credsOk = hasCfCreds(settings);
  const brainUrl = settings.voiceBrainUrl?.trim() || DEFAULT_BRAIN_URL;
  const model = settings.voiceModel || DEFAULT_VOICE_MODEL;

  // The per-turn voice config, read fresh from the live settings ref.
  function cfg() {
    const s = settingsRef.current;
    return {
      creds: {
        accountId: s.voiceCfAccountId?.trim() ?? '',
        apiToken: s.voiceCfApiToken?.trim() ?? '',
      } as CfCreds,
      brainUrl: s.voiceBrainUrl?.trim() || DEFAULT_BRAIN_URL,
      speaker: s.voiceSpeaker || DEFAULT_SPEAKER,
      model: s.voiceModel || DEFAULT_VOICE_MODEL,
    };
  }

  useEffect(() => {
    let on = true;
    void pingBrain(brainUrl).then((ok) => on && setBrainOk(ok));
    return () => {
      on = false;
    };
  }, [brainUrl]);

  // Upload the PR's FULL diff to the brain once it's loaded, so Andy can Read any
  // file on demand (step 2 of the context fix). The inline excerpt handles most
  // questions; this is the overflow path for trimmed/huge PRs. Best-effort — a
  // failed upload just leaves workspaceId null and turns fall back to inline.
  useEffect(() => {
    const files = ctx?.prDiff?.files;
    if (!ctx || !files?.length) {
      workspaceIdRef.current = null;
      return;
    }
    let on = true;
    const key = `${ctx.pr.owner}/${ctx.pr.repo}#${ctx.pr.number}`;
    void uploadBrainContext(brainUrl, key, files).then((res) => {
      if (on) workspaceIdRef.current = res?.workspaceId ?? null;
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainUrl, ctx?.pr.owner, ctx?.pr.repo, ctx?.pr.number, ctx?.prDiff?.files?.length, ctx?.prDiff?.truncated]);

  // Drive the two orbs straight from the analysers (no per-frame React render).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = io.current;
      const you = v ? v.micLevel() : 0;
      const ai = v ? v.aiLevel() : 0;
      if (youOrb.current) youOrb.current.style.transform = `scale(${1 + Math.min(you, 0.6) * 1.4})`;
      if (aiOrb.current) aiOrb.current.style.transform = `scale(${1 + Math.min(ai, 0.6) * 1.4})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Tear down on unmount.
  useEffect(
    () => () => {
      conversing.current = false;
      abortRef.current?.abort();
      io.current?.close();
      io.current = null;
    },
    [],
  );

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
    );
  }, [turns]);

  function pruneEmptyAssistant() {
    setTurns((t) => {
      const last = t[t.length - 1];
      return last?.role === 'assistant' && !last.text.trim() ? t.slice(0, -1) : t;
    });
  }

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
    pruneEmptyAssistant();
    io.current?.stopPlayback();
  }

  function appendAssistant(delta: string) {
    setTurns((t) => {
      const last = t[t.length - 1];
      if (last?.role !== 'assistant') return t;
      return [...t.slice(0, -1), { ...last, text: last.text + delta }];
    });
  }

  // Merge a partial timing patch into the current assistant bubble.
  function patchLastAssistant(patch: Partial<Turn>) {
    setTurns((t) => {
      const last = t[t.length - 1];
      if (last?.role !== 'assistant') return t;
      return [...t.slice(0, -1), { ...last, ...patch }];
    });
  }

  // Stamp Claude's timing + real token usage onto the current assistant bubble.
  function applyMeta(meta: BrainMeta) {
    patchLastAssistant({
      ms: meta.durationMs,
      ttftMs: meta.ttftMs,
      inTok: meta.inputTokens,
      outTok: meta.outputTokens,
      cacheTok: meta.cacheReadTokens,
    });
  }

  async function startConversation() {
    setError(null);
    if (!credsOk) {
      setError('Add your Cloudflare account id and Workers AI token in Settings first.');
      return;
    }
    if (!io.current) io.current = new VoiceIO();
    try {
      await io.current.startConversation({
        onUtterance: (wav) => void handleUtterance(wav),
        onBargeIn: () => {
          abortRef.current?.abort();
          io.current?.stopPlayback();
        },
      });
      conversing.current = true;
      setMicNeedsGrant(false);
      setStatus('listening');
    } catch (e) {
      // Only a genuine permission/device error means "grant the mic". Anything else
      // (worklet load, AudioContext, wasm…) gets surfaced verbatim so we never
      // mislabel an unrelated failure as "mic blocked" and loop forever.
      if (isMicPermissionError(e)) {
        // The panel can't prompt itself; show the embedded grant iframe (which can).
        // On allow it posts MIC_GRANT_MESSAGE and we auto-retry — see the effect below.
        const state = await queryMicPermission();
        setMicNeedsGrant(true);
        setError(
          state === 'denied'
            ? 'The microphone is blocked for this extension. Click the mic icon in the address bar to allow it, then tap Start.'
            : 'Allow the microphone below — Andy starts listening as soon as you do.',
        );
      } else {
        setMicNeedsGrant(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  startRef.current = () => void startConversation();

  // The embedded grant iframe posts its result up here. On allow, the mic grant is
  // now live for the extension origin, so drop the prompt and start listening at
  // once — the user never has to tap Start again. This is what makes the prompt a
  // ONE-TIME event instead of every-session.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data as MicGrantMessage | undefined;
      if (!d || d.type !== MIC_GRANT_MESSAGE) return;
      if (d.granted) {
        setMicNeedsGrant(false);
        setError(null);
        startRef.current();
      } else {
        setError('Microphone access was blocked. Click the mic icon in the address bar to allow it.');
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function endConversation() {
    conversing.current = false;
    abortRef.current?.abort();
    io.current?.stopConversation();
    setStatus('idle');
  }

  // A committed user utterance. A new one PREEMPTS whatever is in flight (this is what
  // makes barge-in work end-to-end): abort the current turn and chain after its FULL
  // unwind — pump included — then run the new turn. Turns are serialized through
  // inFlightRef so they never overlap on the shared refs, and an interruption is NEVER
  // dropped by a "busy" guard the way the old `if (processing) return` did.
  function handleUtterance(wav: Uint8Array) {
    abortRef.current?.abort(); // preempt the in-flight turn (a barge-in already stopped audio)
    const prev = inFlightRef.current;
    inFlightRef.current = (async () => {
      try {
        await prev; // wait for the prior turn to fully unwind before touching shared state
      } catch {
        /* the prior turn handles its own failures inside runTurn */
      }
      await runTurn(wav);
    })();
  }

  async function runTurn(wav: Uint8Array) {
    io.current?.beginThinking();
    const ac = new AbortController();
    abortRef.current = ac;
    let gotText = false;
    let ttsOk = true;
    let ttsTotal = 0; // summed TTS synthesis time across this turn's sentences
    let pumpDone: Promise<void> | null = null; // hoisted so finally can await the pump on ANY exit
    const { creds, brainUrl, model, speaker } = cfg();
    try {
      setStatus('transcribing');
      const sttStart = Date.now();
      const userText = (await transcribe(creds, wav, { signal: ac.signal })).trim();
      const sttMs = Date.now() - sttStart;
      // Drop empties AND Whisper's silence/echo hallucinations ("you", "thank you", a
      // lone period…) so Andy never answers his own echo with "didn't quite catch that".
      if (!userText || isNoiseTranscript(userText)) return;
      setTurns((t) => [...t, { role: 'user', text: userText }]);

      const systemPrompt = buildVoiceSystemPrompt(ctxRef.current);
      // Stateless context: the last MAX_HISTORY messages only. turnsRef already holds
      // every prior turn (incl. partials kept from a barge-in); we cap here so context
      // and token cost stay bounded as the conversation grows.
      const history: BrainTurn[] = [
        ...turnsRef.current.map((t): BrainTurn => ({ role: t.role, content: t.text })),
        { role: 'user' as const, content: userText },
      ].slice(-MAX_HISTORY);
      // Seed the assistant turn with the STT time + the model that will answer; the
      // Claude and TTS times are stamped on as they complete.
      setTurns((t) => [...t, { role: 'assistant', text: '', sttMs, model }]);
      setStatus('thinking');

      // Pipelined TTS. The brain (producer) pushes finished sentences onto `queue`;
      // a separate pump (consumer) SYNTHESIZES the next sentence WHILE the current one
      // PLAYS. So the brain stream is never blocked on playback, and inter-sentence
      // gaps disappear — only sentence 1's synth is on the critical path. (The old
      // `await speak(s)` per sentence serialized synth↔play↔brain — the main slowness.)
      const queue: string[] = [];
      let produced = false;
      const synthTimed = async (text: string) => {
        const t0 = Date.now();
        const mp3 = await synthesize(creds, text, { speaker, signal: ac.signal });
        return { mp3, ms: Date.now() - t0 };
      };

      const pump = (async () => {
        let i = 0;
        let prefetch: ReturnType<typeof synthTimed> | null = null;
        try {
          // Exit promptly on abort (barge-in) even while waiting for the next sentence,
          // so a preempting turn never has to wait on a spinning pump.
          while (ttsOk && !ac.signal.aborted) {
            if (i >= queue.length) {
              if (produced) break;
              await new Promise((r) => setTimeout(r, 8)); // wait for the next sentence
              continue;
            }
            let synthed: { mp3: Uint8Array; ms: number };
            try {
              synthed = await (prefetch ?? synthTimed(queue[i]));
              prefetch = null;
            } catch (e) {
              if (e instanceof DOMException && e.name === 'AbortError') throw e;
              ttsOk = false; // keep showing text; just stop vocalizing
              setError(`Voice playback failed (${e instanceof Error ? e.message : e}). Showing text only.`);
              break;
            }
            ttsTotal += synthed.ms;
            patchLastAssistant({ ttsMs: ttsTotal });
            // Kick off the NEXT sentence's synthesis so it runs DURING this playback.
            if (i + 1 < queue.length) prefetch = synthTimed(queue[i + 1]);
            i++;
            setStatus('speaking');
            await io.current!.play(synthed.mp3, ac.signal);
          }
        } finally {
          prefetch?.catch(() => {}); // swallow a prefetch rejected by abort
        }
      })();
      pumpDone = pump;

      let buffer = '';
      for await (const delta of streamBrain({
        brainUrl,
        systemPrompt,
        transcript: history,
        model,
        workspaceId: workspaceIdRef.current ?? undefined,
        signal: ac.signal,
        onMeta: applyMeta,
      })) {
        if (ac.signal.aborted) break;
        gotText = true;
        appendAssistant(delta);
        buffer += delta;
        const { sentences, rest } = takeSentences(buffer);
        buffer = rest;
        queue.push(...sentences); // hand sentences to the pump; do NOT block on playback
      }
      const tail = buffer.trim();
      if (tail) queue.push(tail);
      produced = true;
      await pump; // let the pump drain (it may still be speaking the last sentences)

      pruneEmptyAssistant();
      if (!gotText && !ac.signal.aborted) {
        setError(
          'Andy returned no text. Make sure drift-brain is running (npm start) and `claude login` is valid — check ' +
            `${brainUrl}/health?deep=1.`,
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') pruneEmptyAssistant();
      else fail(e);
    } finally {
      // Drain the pump on EVERY exit (incl. the abort path that skips `await pump` above)
      // so no orphan playback survives into the next turn and clobbers its capture.
      if (pumpDone) await pumpDone.catch(() => {});
      io.current?.endTurn(); // back to Listening — unless a barge-in already is (mid-capturing turn N+1)
      if (abortRef.current === ac) abortRef.current = null;
      setStatus(conversing.current ? 'listening' : 'idle');
    }
  }

  const live = status !== 'idle';
  // The mic conversation grounds ONLY on the PR's code diff (pr_diff), which is
  // produced by a live scan — so "grounded" means "a diff is loaded".
  const diffFiles = ctx?.prDiff?.files?.length ?? 0;
  const hasDiff = diffFiles > 0;

  // Live context size = the most recent turn's REAL prompt size, straight from the
  // SDK usage — NOT a tiktoken estimate (tiktoken is OpenAI's tokenizer, wrong for
  // Claude). The full prompt is fresh input_tokens PLUS cache_read (the cached diff
  // system prompt is most of it), so ctx = inTok + cacheTok — showing only inTok
  // read as a nonsense "2 ctx". With MAX_HISTORY it plateaus instead of climbing.
  let lastUsage: Turn | undefined;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].inTok != null) {
      lastUsage = turns[i];
      break;
    }
  }
  const ctxTokens = lastUsage ? (lastUsage.inTok ?? 0) + (lastUsage.cacheTok ?? 0) : 0;

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <button className="iconbtn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Talk to Andy</h1>
        <span className="spacer" />
        <span className={`voice-pill voice-${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      <VoiceModeTabs mode="browser" />

      <div className="voice-brainbar" title="The Claude model Andy thinks with — change anytime; applies next turn">
        <span className="voice-brain-label">🧠 Brain</span>
        <select
          className="model-select"
          value={model}
          onChange={(e) => void patchSettings({ voiceModel: e.target.value })}
        >
          {VOICE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="spacer" />
        {lastUsage?.inTok != null && (
          <span
            className="voice-ctxtok"
            title={`Real prompt size last turn: ${ctxTokens.toLocaleString()} tokens = the diff system prompt + last ${MAX_HISTORY} messages (${(lastUsage.inTok ?? 0).toLocaleString()} fresh + ${(lastUsage.cacheTok ?? 0).toLocaleString()} cached). Exact from the model — capped by the diff budget, so it plateaus.`}
          >
            🎟 {fmtTokens(ctxTokens)} ctx
            {lastUsage.cacheTok != null && lastUsage.cacheTok > 0 ? ` · ${fmtTokens(lastUsage.cacheTok)} cached` : ''}
          </span>
        )}
      </div>

      {ctx && (
        <div
          className="voice-context"
          title={hasDiff ? `Andy is grounded on the diff — ${diffFiles} changed file(s)` : 'No diff loaded — run a live scan'}
        >
          <span className="voice-context-pr">
            📎 {ctx.pr.owner}/{ctx.pr.repo} #{ctx.pr.number}
          </span>
          <span className={`voice-context-tag ${hasDiff ? 'ok' : ''}`}>
            {hasDiff ? `✓ diff grounded · ${diffFiles} files` : 'no diff — run a live scan'}
          </span>
        </div>
      )}

      {!credsOk && (
        <div className="voice-banner warn">
          Add your <strong>Cloudflare account id</strong> and <strong>Workers AI token</strong> in Settings to
          enable speech.
        </div>
      )}
      {credsOk && brainOk === false && (
        <div className="voice-banner warn">
          The local brain isn’t reachable at <code>{brainUrl}</code>. Start <code>drift-brain</code> (
          <code>npm start</code>) so Andy can think.
        </div>
      )}
      {!hasDiff && (
        <div className="voice-banner">
          {ctx
            ? 'Run a live scan on this PR so Andy can talk about the code changes.'
            : 'Open a GitHub pull request and run a live scan so Andy has context.'}
        </div>
      )}

      <div className="voice-orbs">
        <div className={`orb-wrap ${live && status !== 'speaking' ? 'active' : ''}`}>
          <div ref={youOrb} className="orb you" />
          <span>You</span>
        </div>
        <div className={`orb-wrap ${status === 'speaking' ? 'active' : ''}`}>
          <div ref={aiOrb} className="orb ai" />
          <span>Andy</span>
        </div>
      </div>

      <div className="voice-transcript" ref={scrollRef}>
        {turns.length === 0 ? (
          <div className="chat-empty">
            <h2>Hands-free PR review</h2>
            <p>Tap “Start”, then just talk. Andy answers out loud — talk over him to interrupt.</p>
          </div>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={`msg ${t.role}`}>
              <div className={`bubble ${t.role === 'assistant' ? 'muted' : ''}`}>
                {t.text || (t.role === 'assistant' ? '…' : '')}
              </div>
              {t.role === 'assistant' &&
                (t.sttMs != null || t.ms != null || t.ttsMs != null || t.inTok != null) && (
                  <div className="msg-timing">
                    {t.sttMs != null && (
                      <span className="t-seg" title="Speech-to-text (Cloudflare Whisper)">
                        🎙 STT {fmtDuration(t.sttMs)}
                      </span>
                    )}
                    {t.ms != null && (
                      <span className="t-seg" title="Claude response time (wall-clock)">
                        🧠 {shortModel(t.model)} {fmtDuration(t.ms)}
                        {t.ttftMs != null ? ` · ${fmtDuration(t.ttftMs)} to first token` : ''}
                      </span>
                    )}
                    {t.inTok != null && (
                      <span
                        className="t-seg"
                        title="Tokens this turn. Input = full prompt reprocessed (replayed session + diff); cache = served from the prompt cache. Rising input with low cache = context bloat."
                      >
                        🎟 {fmtTokens(t.inTok)} in
                        {t.cacheTok != null && t.cacheTok > 0 ? ` (${fmtTokens(t.cacheTok)} cached)` : ''}
                        {t.outTok != null ? ` · ${fmtTokens(t.outTok)} out` : ''}
                      </span>
                    )}
                    {t.ttsMs != null && (
                      <span className="t-seg" title="Text-to-speech synthesis (Cloudflare)">
                        🔊 TTS {fmtDuration(t.ttsMs)}
                      </span>
                    )}
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="voice-banner err" role="alert">
          {error}
        </div>
      )}

      {/* In-panel mic grant. A side panel can't prompt for getUserMedia itself, but a
          same-origin iframe with allow="microphone" can — and the resulting grant is
          stored against the extension origin, so the panel captures silently from then
          on. The iframe requests on load; if the gesture was lost, its own "Try again"
          button re-requests. On allow it posts up and we auto-start (see the effect). */}
      {micNeedsGrant && (
        <div className="voice-mic-grant">
          <iframe title="Enable microphone for Andy" src={permissionUrl()} allow="microphone" />
          <button className="btn ghost" onClick={() => openPermissionTab()}>
            Open in a tab instead
          </button>
        </div>
      )}

      <div className="voice-controls">
        <button
          className={`voice-mic ${live ? 'recording' : ''}`}
          onClick={() => (live ? endConversation() : void startConversation())}
          disabled={!credsOk}
          title={live ? 'End conversation' : 'Start conversation'}
        >
          {live ? '■ End conversation' : '🎙 Start conversation'}
        </button>
      </div>
    </div>
  );
}
