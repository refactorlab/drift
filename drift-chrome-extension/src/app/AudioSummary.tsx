// A chat card that plays the PR's spoken summary. Mirrors the banner the action
// posts in the comment ("🔊 Listen to the spoken summary (Piper TTS)") — press
// once to download the artifact via the GitHub session, then it reveals a
// native <audio> player. Lazy on purpose: we don't fetch audio until asked.

import { useEffect, useRef, useState } from 'react';
import type { AudioRef } from '../core/types';
import { loadAudio } from '../state/audio';

type Phase = 'idle' | 'loading' | 'ready' | 'error';

function fmtBytes(n: number): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AudioSummary({ audio }: { audio: AudioRef }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [src, setSrc] = useState<string | null>(null);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLAudioElement>(null);

  // Re-fetch when the PR (and thus the artifact URL) changes.
  useEffect(() => {
    setPhase('idle');
    setSrc(null);
    setError(null);
  }, [audio.url]);

  async function load() {
    if (phase === 'loading' || phase === 'ready') return;
    setPhase('loading');
    const res = await loadAudio(audio);
    if (res.ok) {
      setSrc(res.dataUrl);
      setBytes(res.bytes);
      setPhase('ready');
      // Autoplay once it's in; browsers may block, so it's best-effort.
      requestAnimationFrame(() => void playerRef.current?.play().catch(() => void 0));
    } else {
      setError(res.error);
      setPhase('error');
    }
  }

  return (
    <div className="audio-card">
      <div className="audio-head">
        <span className="audio-glyph" aria-hidden>
          🔊
        </span>
        <span className="audio-title">{audio.label || 'Listen to the spoken summary'}</span>
        {phase === 'ready' && bytes > 0 && <span className="audio-size">{fmtBytes(bytes)}</span>}
      </div>

      {phase === 'idle' && (
        <button className="audio-play" onClick={() => void load()}>
          ▶ Play summary
        </button>
      )}
      {phase === 'loading' && (
        <div className="audio-loading">
          <span className="spinner" /> Downloading audio via your GitHub session…
        </div>
      )}
      {phase === 'ready' && src && (
        <audio ref={playerRef} className="audio-player" src={src} controls preload="auto" />
      )}
      {phase === 'error' && (
        <div className="audio-err">
          ⚠ Couldn’t load audio ({error}).{' '}
          <button className="audio-retry" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
