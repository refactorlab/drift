// <DeckPlayer> — renders an ExplainerDoc (the `summary_presentation_deck` tool's output)
// as a playable, in-chat slide deck: a NARRATED walkthrough (real on-device Kokoro
// TTS, with a Web-Speech fallback), a transport (play / scrub), two-host karaoke
// captions, per-slide AI questions you can expand (progressive disclosure), the
// file-scoped change-impact graph, a scope map and a critique.
//
// Audio path: pressing play (or autoPlay in voice mode) synthesizes the current
// slide's narration through the SAME shared Kokoro engine SpokenSummary uses, plays
// it through a native <audio>, and advances to the next slide when it ends — the
// karaoke + scrub ride the audio's currentTime mapped onto presentationClock offsets,
// so captions, the playhead and the spoken word stay in lockstep. When Kokoro isn't
// staged we fall back to the browser's speechSynthesis; when neither exists (tests,
// audio disabled) we fall back to a silent timed clock so the deck still advances.
// Themed entirely with the --drift-* tokens, so dark/light follow the panel.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExplainerDoc, DeckSlide, DeckQuestion } from '../../agents/explainerDoc';
import { ChangeImpactGraph } from './ChangeImpactGraph';
import { getSharedTtsProvider } from '../../core/ttsEngine';
import { isTtsAvailable } from '../../core/ttsStore';
import { getSettings } from '../../state/settings';
import { beatStartOffsets, planDurationMs, fmtClock, type TimedBeat } from '../../agents/presentationClock';
import './DeckPlayer.css';

const SEV: Record<DeckQuestion['severity'], string> = { critical: 'crit', important: 'imp', context: 'ctx' };
const GLYPH: Record<DeckSlide['kind'], string> = { overview: '○', file: '▣', graph: '◆', mindmap: '✶', critique: '!' };
const basename = (p: string): string => p.split('/').pop() || p;
type Engine = 'kokoro' | 'speech' | 'none';
type Status = 'idle' | 'loading' | 'playing' | 'paused';

export function DeckPlayer({ doc, soundEnabled = false, autoPlay = false }: { doc: ExplainerDoc; soundEnabled?: boolean; autoPlay?: boolean }) {
  const slides = doc.slides;
  const beats: TimedBeat[] = useMemo(() => slides.map((s) => ({ dwellMs: s.durationSec * 1000 })), [slides]);
  const offsets = useMemo(() => beatStartOffsets(beats, 'text'), [beats]);
  const totalMs = useMemo(() => planDurationMs(beats, 'text'), [beats]);

  const [elapsed, setElapsedState] = useState(0);
  const [cur, setCur] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const driverRef = useRef<'audio' | 'timed'>('timed');
  const curRef = useRef(0);
  const elapsedRef = useRef(0);
  const blobCache = useRef<Map<number, string>>(new Map());
  const speechVoiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const raf = useRef<number | null>(null);
  const base = useRef(0);
  const since = useRef<number | null>(null);
  const autoRan = useRef(false);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const setElapsed = (v: number) => { elapsedRef.current = v; setElapsedState(v); };

  // cleanup: stop audio/speech + revoke synthesized blobs on unmount
  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (speechSupported) window.speechSynthesis.cancel();
      for (const url of blobCache.current.values()) URL.revokeObjectURL(url);
      blobCache.current.clear();
    };
  }, [speechSupported]);

  // Web Speech voices (fallback) load async — grab a local English one.
  useEffect(() => {
    if (!speechSupported) return;
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      speechVoiceRef.current = vs.find((v) => v.localService && /^en(-|_|$)/i.test(v.lang)) ?? vs.find((v) => /^en(-|_|$)/i.test(v.lang)) ?? vs[0];
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [speechSupported]);

  const slideText = (i: number): string => slides[i].narration.map((l) => l.text).join('  ');

  async function resolveEngine(): Promise<Engine> {
    if (engineRef.current) return engineRef.current;
    let eng: Engine = 'none';
    try {
      const { ttsEnabled, ttsUrl } = await getSettings();
      if (ttsEnabled === false) eng = speechSupported ? 'speech' : 'none';
      else if (await isTtsAvailable(ttsUrl)) eng = 'kokoro';
      else if (speechSupported) eng = 'speech';
    } catch {
      eng = speechSupported ? 'speech' : 'none';
    }
    engineRef.current = eng;
    return eng;
  }

  async function ensureBlob(i: number): Promise<string> {
    const cached = blobCache.current.get(i);
    if (cached) return cached;
    let voice: string | undefined;
    try { voice = (await getSettings()).ttsVoice; } catch { /* default voice */ }
    const res = await getSharedTtsProvider().synthesize({ text: slideText(i), voice });
    const url = URL.createObjectURL(new Blob([res.wav.buffer as ArrayBuffer], { type: 'audio/wav' }));
    blobCache.current.set(i, url);
    return url;
  }

  function gotoElapsed(i: number) {
    curRef.current = i;
    setCur(i);
    setElapsed(offsets[i] ?? 0);
  }

  async function startSlide(i: number) {
    gotoElapsed(i);
    if (engineRef.current === 'kokoro') {
      setStatus('loading');
      try {
        const url = await ensureBlob(i);
        const el = audioRef.current;
        if (!el) return;
        el.src = url;
        el.currentTime = 0;
        await el.play();
        setStatus('playing');
      } catch {
        engineRef.current = speechSupported ? 'speech' : 'none';
        if (engineRef.current === 'speech') speakSlide(i);
        else startTimed();
      }
    } else {
      speakSlide(i);
    }
  }

  function speakSlide(i: number) {
    gotoElapsed(i);
    const text = slideText(i);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (speechVoiceRef.current) u.voice = speechVoiceRef.current;
    u.rate = 1.02;
    u.onboundary = (e) => {
      if (text.length) setElapsed((offsets[i] ?? 0) + Math.min(1, e.charIndex / text.length) * (beats[i]?.dwellMs ?? 0));
    };
    u.onend = () => advance(i);
    setStatus('playing');
    window.speechSynthesis.speak(u);
  }

  function advance(i: number) {
    if (i + 1 < slides.length) void startSlide(i + 1);
    else { setStatus('idle'); setElapsed(totalMs); }
  }

  function startTimed() {
    driverRef.current = 'timed';
    base.current = elapsedRef.current >= totalMs ? 0 : elapsedRef.current;
    if (elapsedRef.current >= totalMs) setElapsed(0);
    since.current = performance.now();
    setStatus('playing');
    const loop = () => {
      if (since.current == null) return;
      const e = Math.min(totalMs, base.current + (performance.now() - since.current));
      setElapsed(e);
      // keep cur in step with the timed playhead
      let idx = 0;
      for (let k = 0; k < offsets.length; k++) if (e >= offsets[k]) idx = k;
      if (idx !== curRef.current) { curRef.current = idx; setCur(idx); }
      if (e >= totalMs) { since.current = null; setStatus('idle'); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  async function play() {
    if (status === 'playing') return;
    if (status === 'paused') { resume(); return; }
    const eng = await resolveEngine();
    if (eng === 'kokoro' || eng === 'speech') { driverRef.current = 'audio'; await startSlide(curRef.current); }
    else startTimed();
  }
  function pause() {
    if (driverRef.current === 'timed') { since.current = null; if (raf.current) cancelAnimationFrame(raf.current); }
    else if (engineRef.current === 'kokoro') audioRef.current?.pause();
    else if (speechSupported) window.speechSynthesis.pause();
    setStatus('paused');
  }
  function resume() {
    if (driverRef.current === 'timed') startTimed();
    else if (engineRef.current === 'kokoro') void audioRef.current?.play();
    else if (speechSupported) window.speechSynthesis.resume();
    setStatus('playing');
  }
  function jump(i: number) {
    if (i < 0 || i >= slides.length) return;
    if (status === 'playing') {
      if (driverRef.current === 'audio') void startSlide(i);
      else { gotoElapsed(i); base.current = offsets[i] ?? 0; since.current = performance.now(); }
    } else {
      if (speechSupported) window.speechSynthesis.cancel();
      gotoElapsed(i);
    }
  }

  // auto-play once (voice mode)
  useEffect(() => {
    if (autoPlay && !autoRan.current) { autoRan.current = true; void play(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const slide = slides[cur];
  const within = beats[cur] ? Math.max(0, Math.min(1, (elapsed - offsets[cur]) / beats[cur].dwellMs)) : 0;
  const words = useMemo(
    () => slide.narration.flatMap((l) => l.text.split(/\s+/).filter(Boolean).map((word) => ({ who: l.who, word }))),
    [slide],
  );
  const onIdx = Math.min(words.length - 1, Math.floor(within * words.length));
  const speaker = words[onIdx]?.who ?? 'A';
  const playing = status === 'playing';

  function QCard({ q, k }: { q: DeckQuestion; k: string }) {
    const isOpen = !!open[k];
    return (
      <div className={`dp-q sev-${SEV[q.severity]}`}>
        <button className="dp-q-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))}>
          <span className="dp-q-text">{q.text}</span>
          <span className="dp-q-meta">
            {q.file && <span className="dp-pill">{basename(q.file)}</span>}
            <span className="dp-sev">{q.severity}</span>
            <span className="dp-chev">{isOpen ? '▾' : '▸'}</span>
          </span>
        </button>
        {isOpen && (
          <div className="dp-answer">
            {q.answer ?? 'Ask drift to answer this — it routes to the lens agents, grounded in the scan.'}
            {q.fix && <div className="dp-fix">→ {q.fix}</div>}
            {!!q.cites?.length && (
              <div className="dp-cites">
                <span className="dp-cites-lbl">grounded in</span>
                {q.cites.map((c) => (
                  <span key={c} className="dp-cite">{basename(c)}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderStage(s: DeckSlide) {
    return (
      <>
        <div className="dp-eyebrow">{s.eyebrow}</div>
        <h3 className="dp-title">{s.title}</h3>
        {s.kind === 'mindmap' && s.subsystems && (
          <div className="dp-smap">
            {s.subsystems.map((g) => (
              <div key={g.root} className={`dp-srow cov-${g.coverage}`}>
                <span className="dp-sname">{g.root}</span>
                <span className="dp-sloc">{g.files} · {g.loc} LOC</span>
                <span className={`dp-sbadge cov-${g.coverage}`}>{g.coverage}</span>
              </div>
            ))}
          </div>
        )}
        {s.kind === 'critique' && s.critique && (
          <div className="dp-crit">
            {s.critique.map((c, i) => (
              <div key={i} className={`dp-crit-item k-${c.kind}`}>
                <span className="dp-crit-glyph">{c.kind === 'good' ? '✓' : c.kind === 'risk' ? '!' : '×'}</span>
                <span><b>{c.title}.</b> {c.detail}</span>
              </div>
            ))}
          </div>
        )}
        {s.graph && (
          <div className="dp-graph">
            <ChangeImpactGraph graph={s.graph} soundEnabled={soundEnabled} filePath={s.path} />
          </div>
        )}
        {!!s.questions?.length && (
          <div className="dp-qlist">
            {s.questions.map((q, i) => (
              <QCard key={`${cur}:${i}`} q={q} k={`${cur}:${i}`} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="dp">
      <div className="dp-head">
        <span className={`dp-verdict v-${doc.verdict}`}>{doc.verdictLabel || doc.verdict}</span>
        <span className="dp-counter">
          <span className="dp-g">{GLYPH[slide.kind]}</span> {String(cur + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      </div>

      <div className="dp-stage-wrap">
        <div className="dp-prog" style={{ width: `${(elapsed / totalMs) * 100 || 0}%` }} />
        <button className="dp-nav prev" aria-label="Previous slide" disabled={cur === 0} onClick={() => jump(cur - 1)}>‹</button>
        <button className="dp-nav next" aria-label="Next slide" disabled={cur === slides.length - 1} onClick={() => jump(cur + 1)}>›</button>
        <div className="dp-stage">{renderStage(slide)}</div>
      </div>

      <div className="dp-transport">
        <button className="dp-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? pause() : void play())}>
          {status === 'loading' ? '…' : playing ? '❚❚' : '▶'}
        </button>
        <div
          className="dp-scrub"
          role="slider"
          aria-valuenow={Math.round(elapsed / 1000)}
          aria-valuemax={Math.round(totalMs / 1000)}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            // map the scrub fraction to the nearest slide and seek there
            const target = f * totalMs;
            let idx = 0;
            for (let k = 0; k < offsets.length; k++) if (target >= offsets[k]) idx = k;
            jump(idx);
          }}
        >
          <div className="dp-fill" style={{ width: `${(elapsed / totalMs) * 100 || 0}%` }} />
        </div>
        <span className="dp-clock">{fmtClock(elapsed)} / {fmtClock(totalMs)}</span>
      </div>

      <div className={`dp-caption host-${speaker}`}>
        <span className="dp-host">{speaker}</span>
        <span className="dp-words">
          {words.map((w, i) => (
            <span key={i} className={`dp-w ${w.who} ${i === onIdx ? 'on' : i < onIdx ? 'done' : ''}`}>{w.word} </span>
          ))}
        </span>
      </div>

      <div className="dp-filmstrip">
        {slides.map((s, i) => (
          <button key={i} className={`dp-frame ${i === cur ? 'active' : ''}`} onClick={() => jump(i)}>
            <span className="dp-ftype">{s.kind}</span>
            <span className="dp-fname">{GLYPH[s.kind]} {s.title}</span>
          </button>
        ))}
      </div>

      {/* Kokoro plays through this native element; events drive karaoke + advance. */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration > 0) {
            const i = curRef.current;
            setElapsed((offsets[i] ?? 0) + Math.min(1, el.currentTime / el.duration) * (beats[i]?.dwellMs ?? 0));
          }
        }}
        onEnded={() => advance(curRef.current)}
      />
    </div>
  );
}
