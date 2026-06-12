import { useEffect, useRef, useState } from 'react';
import { patchSettings, type Settings } from '../state/settings';
import { usePrContext } from '../state/prContext';
import { buildCallInstruction } from '../core/voicePrompt';
import {
  hasDialCreds,
  listNumbers,
  placeCall,
  pollCall,
  isTerminalStatus,
  statusText,
  type DialCall,
  type DialNumber,
} from '../core/dialVoice';
import { VoiceModeTabs } from './VoiceModeTabs';

// The Dial PHONE-CALL agent. Unlike the browser mode (Voice.tsx), nothing runs
// locally: Dial rings the user's phone and runs the whole conversation. We POST the
// PR grounding as the agent's instruction, then poll the call until it ends and show
// the transcript. Mirrors Dial's own "Test an outbound call" panel.

type Phase = 'idle' | 'placing' | 'live' | 'done' | 'error';

// Cheap, naive E.164 check — a leading "+" and 8–15 digits. Just enough to stop an
// obviously-wrong number before we spend a call; Dial does the real validation.
function looksLikeE164(s: string): boolean {
  return /^\+\d{8,15}$/.test(s.trim());
}

// Title-case a Dial status for the pill ("in-progress" → "In progress"). Reads from
// either status shape via statusText(), so it never touches a missing field.
function statusLabel(call: DialCall | null): string {
  const s = statusText(call?.status).replace(/[-_]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '—';
}

// Why a terminated call ended with no conversation (busy / no-answer / failed),
// pulled from whichever field Dial populated. Empty for a normal completion.
function terminationReason(call: DialCall | null): string {
  if (!call) return '';
  const t =
    call.terminationType ??
    (typeof call.status === 'object' ? call.status?.terminationType : undefined) ??
    '';
  const norm = t.trim().toLowerCase();
  if (!norm || norm === 'completed') return '';
  const FRIENDLY: Record<string, string> = {
    busy: 'the line was busy',
    'no-answer': 'there was no answer',
    failed: 'the call failed',
    canceled: 'the call was canceled',
    cancelled: 'the call was canceled',
  };
  return FRIENDLY[norm] ?? norm.replace(/[-_]+/g, ' ');
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// One line of the transcript, classed by who spoke so we can render it as chat.
type Turn = { who: 'agent' | 'caller' | 'note'; speaker: string; text: string };

// Andy's side of the call (the AI agent) — everything else is treated as the caller.
const AGENT_SPEAKERS = /^(andy|agent|assistant|ai|bot)$/i;

// Dial returns the transcript as a plain string, typically one "Speaker: line" per
// turn. Split it into chat turns; lines without a "Speaker:" prefix fold into the
// previous turn (wrapped text) or render as a standalone note.
function parseTranscript(transcript: string): Turn[] {
  const turns: Turn[] = [];
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-Za-z][\w .'-]{0,30}?):\s*(.*)$/.exec(line);
    if (m) {
      const speaker = m[1].trim();
      turns.push({ who: AGENT_SPEAKERS.test(speaker) ? 'agent' : 'caller', speaker, text: m[2].trim() });
    } else if (turns.length) {
      turns[turns.length - 1].text += `\n${line}`;
    } else {
      turns.push({ who: 'note', speaker: '', text: line });
    }
  }
  return turns;
}

export function PhoneCall({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const { ctx } = usePrContext();
  const [phase, setPhase] = useState<Phase>('idle');
  const [call, setCall] = useState<DialCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<DialNumber[] | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Live settings/ctx refs so the async call flow reads the latest values.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const apiKey = settings.dialApiKey?.trim() ?? '';
  const credsOk = hasDialCreds(settings);
  const toNumber = settings.dialToNumber?.trim() ?? '';
  const fromId = settings.dialFromNumberId?.trim() ?? '';
  const fromNumber = numbers?.find((n) => n.id === fromId);

  const diffFiles = ctx?.prDiff?.files?.length ?? 0;
  const hasDiff = diffFiles > 0;
  const busy = phase === 'placing' || phase === 'live';

  // Resolve the account's Dial numbers once a key is present, so we can show the
  // "from" number and auto-select it when there's exactly one (the common case).
  useEffect(() => {
    if (!apiKey) {
      setNumbers(null);
      return;
    }
    let on = true;
    void listNumbers(apiKey)
      .then((ns) => {
        if (!on) return;
        setNumbers(ns);
        if (!settingsRef.current.dialFromNumberId && ns.length === 1) {
          void patchSettings({ dialFromNumberId: ns[0].id });
        }
      })
      .catch((e) => on && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      on = false;
    };
  }, [apiKey]);

  // Stop polling on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function startCall() {
    setError(null);
    const s = settingsRef.current;
    const to = s.dialToNumber?.trim() ?? '';
    const from = s.dialFromNumberId?.trim() ?? '';
    if (!hasDialCreds(s)) return setError('Add your Dial API key in Settings first.');
    if (!from) return setError('No Dial number to call from. Open Settings to pick one.');
    if (!looksLikeE164(to)) return setError('Enter the phone number to call in E.164 format, e.g. +14155550123.');

    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('placing');
    setCall(null);
    try {
      const instruction = buildCallInstruction(ctxRef.current);
      const placed = await placeCall(
        s.dialApiKey!.trim(),
        {
          to,
          fromNumberId: from,
          outboundInstruction: instruction,
          language: s.dialLanguage?.trim() || undefined,
          voiceGender: s.dialVoiceGender || undefined,
        },
        { signal: ac.signal, idempotencyKey: crypto.randomUUID() },
      );
      setCall(placed);
      setPhase('live');
      const final = await pollCall(s.dialApiKey!.trim(), placed.id, {
        signal: ac.signal,
        onUpdate: setCall,
      });
      setCall(final);
      setPhase('done');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User cancelled the local poll — the call itself keeps going on Dial's side.
        setPhase(call ? 'done' : 'idle');
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  function stopWatching() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  const transcript = call?.transcript?.trim();
  const terminal = call ? !!call.terminatedAt || isTerminalStatus(call.status) : false;
  const reason = terminal ? terminationReason(call) : '';
  const turns = transcript ? parseTranscript(transcript) : [];
  // The call ended but its transcript is still being produced — we keep polling
  // (phase stays 'live') until it lands or the grace window elapses.
  const fetchingTranscript = terminal && !transcript && !reason && phase === 'live';

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <button className="iconbtn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Call from Andy</h1>
        <span className="spacer" />
        {call && <span className={`voice-pill voice-${terminal ? 'idle' : 'speaking'}`}>{statusLabel(call)}</span>}
      </header>

      <VoiceModeTabs mode="phone" />

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
          Add your <strong>Dial API key</strong> in Settings to place a call. Dial runs the speech and the
          conversation — no Cloudflare or local brain needed.
        </div>
      )}
      {credsOk && !fromId && (
        <div className="voice-banner warn">
          No Dial number selected to call from. Open Settings → <strong>Phone call</strong> to pick one.
        </div>
      )}
      {credsOk && !hasDiff && (
        <div className="voice-banner">
          {ctx
            ? 'Run a live scan on this PR so Andy can talk about the code changes on the call.'
            : 'Open a GitHub pull request and run a live scan so Andy has something to discuss.'}
        </div>
      )}

      <div className="phone-card">
        <div className="phone-field">
          <label className="label" htmlFor="dial-to">
            Call this phone
          </label>
          <div className="hint">Andy calls this number and walks through the PR. Use E.164, e.g. +14155550123.</div>
          <input
            id="dial-to"
            className="text-input"
            type="tel"
            inputMode="tel"
            spellCheck={false}
            placeholder="+14155550123"
            value={toNumber}
            disabled={busy}
            onChange={(e) => void patchSettings({ dialToNumber: e.target.value.trim() })}
          />
        </div>

        <div className="phone-field">
          <label className="label">Calling from</label>
          <div className="hint">
            {fromNumber
              ? `${fromNumber.number}${fromNumber.country ? ` · ${fromNumber.country}` : ''}`
              : credsOk
                ? numbers === null
                  ? 'Loading your Dial numbers…'
                  : 'No number selected — choose one in Settings.'
                : 'Add your API key to load your Dial numbers.'}
          </div>
        </div>

        <div className="phone-actions">
          {!busy ? (
            <button
              className="voice-mic"
              onClick={() => void startCall()}
              disabled={!credsOk || !fromId || !looksLikeE164(toNumber)}
              title="Place the call"
            >
              📞 Call me
            </button>
          ) : (
            <button className="voice-mic recording" onClick={stopWatching} title="Stop watching this call">
              {phase === 'placing' ? 'Placing…' : '■ Stop watching'}
            </button>
          )}
        </div>
      </div>

      <div className="phone-result">
        <div className="phone-result-head">
          <span>📲 Call result</span>
          <span className="spacer" />
          {call && <span className="phone-result-status">{statusLabel(call)}</span>}
        </div>

        {!call ? (
          <div className="phone-result-empty">
            <p>Enter a number and tap “Call me”. Your phone rings; the outcome and transcript show here when the call ends.</p>
          </div>
        ) : (
          <div className="phone-result-body">
            <div className="phone-result-meta">
              {call.to && <span>To {call.to}</span>}
              {call.duration ? <span>· {fmtDuration(call.duration)}</span> : null}
              {!terminal && <span className="phone-live-dot">● live</span>}
            </div>
            {turns.length ? (
              <div className="phone-chat">
                {turns.map((t, i) =>
                  t.who === 'note' ? (
                    <div key={i} className="phone-chat-note">
                      {t.text}
                    </div>
                  ) : (
                    <div key={i} className={`phone-chat-turn ${t.who}`}>
                      <span className="phone-chat-who">{t.speaker}</span>
                      <div className="phone-chat-bubble">{t.text}</div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="phone-result-waiting">
                {fetchingTranscript
                  ? 'Call ended — fetching the transcript…'
                  : terminal
                    ? reason
                      ? `Call ended — ${reason}. No conversation to transcribe.`
                      : 'Call ended — no transcript was produced.'
                    : 'On the call… the transcript appears once it ends.'}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="voice-banner err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
