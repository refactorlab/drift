// On-device spoken summary of a live scan. The live-scan path is "no AI, no
// API", and so is its audio: we synthesize narration locally with the SAME
// Kokoro voice engine the GitHub Action uses (sherpa-onnx compiled to WASM,
// run in-tab — see core/ttsProvider + core/ttsStore). This replaces the action's
// old Piper engine end-to-end: the extension now speaks with the identical
// Kokoro voice the PR comment's "🔊 (Kokoro TTS)" artifact was produced with.
//
// Kokoro produces a real 24 kHz WAV played through a native <audio> element.
// When the Kokoro assets aren't staged on this device (they're large and built
// out-of-band by scripts/build-tts.sh, so a dev checkout may lack them), we
// fail SOFT to the browser's Web Speech API (window.speechSynthesis) so the
// feature still works everywhere — mirroring the action's fully fail-soft audio.
//
// The narration TEXT is the pure buildNarration() (liveSummary.ts); this
// component only resolves an engine and drives playback.
//
// EAGER MODE: when the live-scan pipeline has already synthesized the audio (its
// "Spoken summary" step), it hands the finished WAV down via the `prepared` prop.
// We then skip engine probing + lazy synthesis entirely and arm a blob the first
// press plays INSTANTLY — no model load on the click path. Without `prepared`
// (e.g. replaying a past scan), the lazy Kokoro→Web-Speech path below still runs.

import { useEffect, useRef, useState } from 'react';
import { type PreparedAudio } from '../core/ttsProvider';
import { getSharedTtsProvider } from '../core/ttsEngine';
import { isTtsAvailable } from '../core/ttsStore';
import { getSettings } from '../state/settings';

type Engine = 'probing' | 'kokoro' | 'speech' | 'none';
type Phase = 'idle' | 'loading' | 'speaking' | 'paused';

/** Prefer a local English voice so the fallback playback is instant + offline. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) => v.localService && /^en(-|_|$)/i.test(v.lang)) ??
    voices.find((v) => /^en(-|_|$)/i.test(v.lang)) ??
    voices[0]
  );
}

export function SpokenSummary({
  text,
  prepared,
  onSynthesized,
}: {
  text: string;
  /** Audio synthesized ahead of time by the pipeline → instantly playable. */
  prepared?: PreparedAudio | null;
  /** Fired once when THIS component lazily synthesizes a clip (the Kokoro path,
   *  not the system-voice fallback). Lets the parent cache it back to the scan
   *  record so a later replay is instant — see LivePipelineRun.cacheSynthesized. */
  onSynthesized?: (audio: PreparedAudio) => void;
}) {
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [engine, setEngine] = useState<Engine>('probing');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0); // 0..1
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Kokoro plays through a native <audio> element. The synthesized blob URL is
  // cached for this text so a re-press never re-runs the model; it's revoked when
  // the text changes or on unmount. The ENGINE itself is the app-wide shared
  // provider (getSharedTtsProvider) — NOT a per-card instance — so the model loads
  // once for the whole panel and the card reuses the pipeline's warm worker
  // instead of loading the 92 MB model a second time.
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Web Speech fallback: a local voice.
  const speechVoiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  // Resolve the engine once: prefer Kokoro (matches the action's audio), fall
  // back to the browser voice, else hide the card entirely. The Kokoro check is
  // a CHEAP reachability probe (isTtsAvailable) — it does NOT instantiate the
  // ~80–300 MB model. The model is loaded lazily on the first Listen, so opening
  // a scan result costs nothing until the user actually asks for audio.
  useEffect(() => {
    // Pre-synthesized by the pipeline → it's Kokoro audio, already in hand. Skip
    // the probe (and never load the model on this path): the blob is armed below.
    if (prepared) {
      setEngine('kokoro');
      return;
    }
    let cancelled = false;
    void (async () => {
      // Respect the user's "Spoken summary" toggle (default on).
      const { ttsEnabled, ttsUrl } = await getSettings();
      if (cancelled) return;
      if (ttsEnabled === false) {
        setEngine('none');
        return;
      }
      const available = await isTtsAvailable(ttsUrl);
      if (cancelled) return;
      if (available) setEngine('kokoro');
      else if (speechSupported) setEngine('speech');
      else setEngine('none');
    })();
    return () => {
      cancelled = true;
    };
  }, [speechSupported, prepared]);

  // Web Speech voices can load asynchronously; grab them now + on change.
  useEffect(() => {
    if (!speechSupported) return;
    const load = () => {
      speechVoiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [speechSupported]);

  // Reset playback whenever the narration text (a new scan) or the prepared audio
  // changes: cancel any in-flight speech, drop the cached Kokoro blob, idle. When
  // the pipeline handed us `prepared` audio, immediately re-arm a fresh blob from
  // it so the first press plays without any model work.
  useEffect(() => {
    setPhase('idle');
    setProgress(0);
    setError(null);
    if (speechSupported) window.speechSynthesis.cancel();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (prepared) {
      const url = URL.createObjectURL(
        new Blob([prepared.wav.buffer as ArrayBuffer], { type: 'audio/wav' }),
      );
      blobUrlRef.current = url;
      setVoiceName(prepared.voice);
      setDuration(prepared.durationSeconds);
    } else {
      setDuration(null);
      setVoiceName(null);
    }
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [text, prepared, speechSupported]);

  if (engine === 'none') return null;

  // ── Kokoro playback ──────────────────────────────────────────────────────
  async function playKokoro() {
    const el = audioRef.current;
    if (!el) return;
    // Cached synthesis (or pipeline-prepared audio) → play immediately, no model
    // run. The eager path arms blobUrlRef before the <audio> exists, so bind src
    // here if it hasn't been bound yet.
    if (blobUrlRef.current) {
      if (el.src !== blobUrlRef.current) el.src = blobUrlRef.current;
      el.currentTime = 0;
      void el.play();
      setPhase('speaking');
      return;
    }
    setPhase('loading');
    setError(null);
    try {
      const { ttsVoice } = await getSettings();
      const res = await getSharedTtsProvider().synthesize({ text, voice: ttsVoice });
      const url = URL.createObjectURL(new Blob([res.wav.buffer as ArrayBuffer], { type: 'audio/wav' }));
      blobUrlRef.current = url;
      setVoiceName(res.voice);
      setDuration(res.durationSeconds);
      el.src = url;
      el.currentTime = 0;
      void el.play();
      setPhase('speaking');
      // Hand the freshly-synthesized clip up so the parent can persist it (this is
      // the only place a real WAV is produced on the lazy path). Best-effort: a
      // throwing handler must never break playback that already started.
      try {
        onSynthesized?.({ wav: res.wav, voice: res.voice, durationSeconds: res.durationSeconds });
      } catch {
        /* parent-side cache is fail-soft; ignore */
      }
    } catch (e) {
      // First synthesis can fail even when the glue probe passed (model assets
      // missing, OOM, engine vanished mid-run). Degrade to the browser voice and
      // — crucially — honor the SAME press by speaking immediately, so the user
      // isn't left to click a second time. Only surface an error if there's no
      // fallback to fall to.
      if (speechSupported) {
        setEngine('speech');
        setError(null);
        playSpeech();
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('idle');
      }
    }
  }

  // ── Web Speech fallback playback ─────────────────────────────────────────
  function playSpeech() {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (speechVoiceRef.current) {
      u.voice = speechVoiceRef.current;
      setVoiceName(speechVoiceRef.current.name);
    }
    u.rate = 1.02;
    u.onboundary = (e) => {
      if (text.length) setProgress(Math.min(1, e.charIndex / text.length));
    };
    u.onend = () => {
      setPhase('idle');
      setProgress(0);
    };
    u.onerror = () => {
      setPhase('idle');
      setProgress(0);
    };
    setProgress(0);
    setPhase('speaking');
    window.speechSynthesis.speak(u);
  }

  const play = () => (engine === 'kokoro' ? void playKokoro() : playSpeech());

  function pause() {
    if (engine === 'kokoro') audioRef.current?.pause();
    else window.speechSynthesis.pause();
    setPhase('paused');
  }
  function resume() {
    if (engine === 'kokoro') void audioRef.current?.play();
    else window.speechSynthesis.resume();
    setPhase('speaking');
  }
  function stop() {
    if (engine === 'kokoro') {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    } else {
      window.speechSynthesis.cancel();
    }
    setPhase('idle');
    setProgress(0);
  }

  const durLabel =
    duration != null
      ? duration < 60
        ? ` · ${Math.round(duration)}s`
        : ` · ${Math.floor(duration / 60)}m${String(Math.round(duration % 60)).padStart(2, '0')}s`
      : '';
  const tag =
    engine === 'kokoro'
      ? `Kokoro · on-device${voiceName ? ` · ${voiceName}` : ''}${durLabel}`
      : 'system voice · fallback';
  const pct = Math.round(progress * 100);

  return (
    <div className="spoken-card" role="group" aria-label="Spoken summary" aria-busy={phase === 'loading'}>
      <div className="spoken-head">
        <span className="spoken-glyph" aria-hidden>
          🔊
        </span>
        <span className="spoken-title">Spoken summary</span>
        <span className="spoken-tag">{tag}</span>
      </div>

      <div className="spoken-controls">
        {(phase === 'idle' || phase === 'loading') && (
          <button
            className="spoken-btn primary"
            onClick={play}
            disabled={phase === 'loading'}
            aria-label={phase === 'loading' ? 'Synthesizing' : 'Listen to the spoken summary'}
          >
            {phase === 'loading' ? '… Synthesizing' : '▶ Listen'}
          </button>
        )}
        {phase === 'speaking' && (
          <button className="spoken-btn" onClick={pause} aria-label="Pause">
            ❚❚ Pause
          </button>
        )}
        {phase === 'paused' && (
          <button className="spoken-btn primary" onClick={resume} aria-label="Resume">
            ▶ Resume
          </button>
        )}
        {(phase === 'speaking' || phase === 'paused') && (
          <button className="spoken-btn ghost" onClick={stop} aria-label="Stop">
            ■ Stop
          </button>
        )}
        <div
          className="spoken-bar"
          role="progressbar"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Kokoro plays through this native element; custom buttons drive it. */}
      {engine === 'kokoro' && (
        <audio
          ref={audioRef}
          style={{ display: 'none' }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) setProgress(Math.min(1, el.currentTime / el.duration));
          }}
          onEnded={() => {
            setPhase('idle');
            setProgress(0);
          }}
        />
      )}

      {error && (
        <div className="hint" role="alert" style={{ color: 'var(--drift-bad-soft)' }}>
          ⚠ {error}
        </div>
      )}

      <details className="spoken-script">
        <summary className="hint">Read the script</summary>
        <p>{text}</p>
      </details>
    </div>
  );
}
