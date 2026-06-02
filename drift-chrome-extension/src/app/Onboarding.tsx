import { useCallback, useState } from 'react';
import { APP_NAME } from '../config';
import { ensureScanner, prewarmScanner } from '../core/scannerStore';
import { ensureTts } from '../core/ttsStore';
import { getSettings } from '../state/settings';

// First-run setup. Production-grade: "Get started" runs a visible SETUP
// CHECKLIST that acquires the extension's runtime dependencies and records
// their versions, so a fresh install lands ready to use.
//
//   • Scan engine  (REQUIRED) — the static drift profiler, compiled to WASM
//     and bundled in the package; ensureScanner() verifies + records it. If it
//     somehow fails (corrupt/offline), the user can continue anyway and it's
//     re-tried on the first scan.
//   • Natural voice (OPTIONAL) — the in-tab Kokoro TTS engine for the spoken
//     summary. It is NOT required for any core feature: when it isn't staged or
//     a download fails, the spoken summary falls back to the browser's system
//     voice. So this step NEVER blocks onboarding and a failure is shown as an
//     informational "using your system voice", not an error.
//
// Each dependency is idempotent + versioned (see scannerStore/ttsStore): a
// returning user with the same version skips straight through; a version bump
// re-acquires. The two run concurrently; "Continue" unlocks the moment the
// REQUIRED engine settles (the optional voice keeps going / can be skipped).

type StepKey = 'scanner' | 'voice';
type StepState = 'pending' | 'running' | 'done' | 'error' | 'skipped';

interface SetupStep {
  key: StepKey;
  label: string;
  hint: string;
  required: boolean;
  state: StepState;
  note?: string;
}

const INITIAL: Record<StepKey, SetupStep> = {
  scanner: {
    key: 'scanner',
    label: 'Scan engine',
    hint: 'Runs the static drift profiler in your browser — no CI, no AI.',
    required: true,
    state: 'pending',
  },
  voice: {
    key: 'voice',
    label: 'Natural voice',
    hint: 'On-device Kokoro voice for the spoken summary. Optional.',
    required: false,
    state: 'pending',
  },
};

function fmtMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'running') return <span className="spinner" />;
  const glyph = { pending: '○', done: '✓', error: '✗', skipped: '–', running: '' }[state];
  return <span className={`ob-step-icon ob-${state}`}>{glyph}</span>;
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState(INITIAL);
  // The REQUIRED engine has settled (succeeded or failed) → "Continue" unlocks.
  const [canContinue, setCanContinue] = useState(false);
  const [scannerOk, setScannerOk] = useState(false);

  const patch = useCallback((key: StepKey, p: Partial<SetupStep>) => {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
  }, []);

  // Acquire the REQUIRED scan engine. Resolves regardless of outcome so the
  // caller can always unlock "Continue".
  const runScanner = useCallback(async () => {
    patch('scanner', { state: 'running', note: 'Preparing…' });
    try {
      const r = await ensureScanner((p) => patch('scanner', { note: p.phase }));
      patch('scanner', { state: 'done', note: `v${r.meta.version} · ${fmtMB(r.meta.bytes)}` });
      setScannerOk(true);
      prewarmScanner(); // warm the compile in the background — don't await
    } catch (e) {
      patch('scanner', { state: 'error', note: e instanceof Error ? e.message : String(e) });
    } finally {
      setCanContinue(true);
    }
  }, [patch]);

  // Acquire the OPTIONAL voice engine. Failure is informational (fail-soft to
  // the system voice), never blocks onboarding.
  const runVoice = useCallback(async () => {
    const { ttsEnabled } = await getSettings();
    if (ttsEnabled === false) {
      patch('voice', { state: 'skipped', note: 'Off — using your system voice' });
      return;
    }
    patch('voice', { state: 'running', note: 'Checking…' });
    try {
      const r = await ensureTts((p) => patch('voice', { note: p.phase }));
      patch('voice', { state: 'done', note: `v${r.meta.version} · ${fmtMB(r.meta.bytes)}` });
    } catch {
      // The ~92 MB model is downloaded on demand from Settings, not here — so
      // onboarding never blocks on it; the spoken summary uses the system voice
      // until the user downloads it.
      patch('voice', { state: 'skipped', note: 'Download in Settings for the on-device voice' });
    }
  }, [patch]);

  const start = useCallback(() => {
    setStarted(true);
    void runScanner();
    void runVoice();
  }, [runScanner, runVoice]);

  return (
    <div className="center-screen onboard">
      <div className="mark-lg" />
      <h1>{APP_NAME}</h1>
      <p className="tagline">Your PR-review copilot — right beside the code.</p>

      {!started ? (
        <>
          <ul className="feature-list">
            <li>
              <span className="fi">🔎</span>
              <div>
                <strong>Instant PR read</strong>
                <span>Verdict, risks and metrics the moment you open a pull request.</span>
              </div>
            </li>
            <li>
              <span className="fi">⚡</span>
              <div>
                <strong>Live scan, no CI, no AI</strong>
                <span>Runs the static drift profiler in your browser and renders the PR comment.</span>
              </div>
            </li>
            <li>
              <span className="fi">🔊</span>
              <div>
                <strong>Spoken summary</strong>
                <span>Hear the scan read aloud with an on-device voice — no AI, no API.</span>
              </div>
            </li>
          </ul>
          <button className="btn block" onClick={start}>
            Get started
          </button>
        </>
      ) : (
        <>
          <div className="ob-checklist">
            {(['scanner', 'voice'] as StepKey[]).map((k) => {
              const s = steps[k];
              return (
                <div key={k} className={`ob-step ob-step-${s.state}`}>
                  <StepIcon state={s.state} />
                  <div className="grow">
                    <div className="ob-step-label">
                      {s.label}
                      {!s.required && <span className="ob-optional">optional</span>}
                    </div>
                    <div className="hint">{s.note ?? s.hint}</div>
                  </div>
                  {s.state === 'error' && s.key === 'scanner' && (
                    <button className="btn ghost" onClick={() => void runScanner()}>
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn block" onClick={onDone} disabled={!canContinue}>
            {!canContinue ? 'Setting up…' : scannerOk ? 'Start using Drift' : 'Continue anyway'}
          </button>
          {canContinue && !scannerOk && (
            <div className="dl-strip warn" style={{ marginTop: 10 }}>
              ⚠ The scan engine didn’t finish preparing — it’ll be re-tried on your first scan.
            </div>
          )}
        </>
      )}

      <div className="onboard-note">No sign-up needed — uses your browser’s GitHub session.</div>
    </div>
  );
}
