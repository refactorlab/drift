import { useState } from 'react';
import { signInWithGoogle, signOut, type AuthState } from '../auth/google';
import { HAS_GOOGLE_OAUTH } from '../config';
import { patchSettings, type Settings as SettingsT, type ThemePref } from '../state/settings';
import { ensureScanner } from '../core/scannerStore';
import { downloadTts } from '../core/ttsStore';
import { KOKORO_VOICE_SID, DEFAULT_VOICE } from '../core/ttsProvider';
import { GoogleIcon } from './GoogleIcon';

// The live-scan engine dependency: shows the acquired wasm version and lets the
// user re-check / update it (uses the bundled build, or settings.scannerUrl).
function ScannerRow({ settings }: { settings: SettingsT }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const s = settings.scanner;

  async function recheck() {
    setBusy(true);
    setNote(null);
    try {
      const r = await ensureScanner((p) => setNote(p.phase));
      setNote(r.status === 'ready' ? `Up to date · v${r.meta.version}` : `${r.status} · v${r.meta.version}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-title">Scan engine</div>
      <div className="row" style={{ borderBottom: 'none' }}>
        <div className="grow">
          <div className="label">Static drift profiler (WASM)</div>
          <div className="hint">
            {note ??
              (s
                ? `v${s.version} · ${(s.bytes / 1024 / 1024).toFixed(1)} MB · ${s.source}`
                : 'Not acquired yet')}
          </div>
        </div>
        <button className="btn ghost" onClick={() => void recheck()} disabled={busy}>
          {busy ? 'Checking…' : 'Check for update'}
        </button>
      </div>
    </>
  );
}

// The live-scan voice engine: the Kokoro WASM synthesizer that speaks the
// spoken summary (the same engine the action uses). Shows the acquired version,
// lets the user toggle audio, pick a voice, and re-check / update the engine.
// When the engine isn't staged, the live scan fails soft to the system voice.
function VoiceEngineRow({ settings }: { settings: SettingsT }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const s = settings.tts;
  const enabled = settings.ttsEnabled !== false; // default on
  const voice = settings.ttsVoice ?? DEFAULT_VOICE;
  const downloaded = s?.source === 'remote';

  // Explicitly download the ~92 MB Kokoro model (a one-time action). Once it's
  // recorded, every live scan synthesises with Kokoro by default.
  async function download() {
    setBusy(true);
    setNote(null);
    setPct(0);
    try {
      const r = await downloadTts((p) => {
        setNote(p.phase);
        setPct(p.fraction != null ? Math.round(p.fraction * 100) : null);
      });
      setNote(r.status === 'ready' ? `Up to date · ${r.meta.version}` : `Downloaded · ${r.meta.version}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPct(null);
    }
  }

  return (
    <>
      <div className="section-title">Voice engine</div>
      <div className="row">
        <div className="grow">
          <div className="label">Spoken summary</div>
          <div className="hint">Narrate the live scan with the on-device Kokoro voice (no AI, no API).</div>
        </div>
        <Switch on={enabled} onChange={(v) => void patchSettings({ ttsEnabled: v })} />
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Voice</div>
          <div className="hint">Kokoro multi-lang voice catalog — matches the action's tts-voice.</div>
        </div>
        <select
          className="model-select"
          value={voice}
          disabled={!enabled}
          onChange={(e) => void patchSettings({ ttsVoice: e.target.value })}
        >
          {Object.keys(KOKORO_VOICE_SID).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="row" style={{ borderBottom: 'none' }}>
        <div className="grow">
          <div className="label">Kokoro voice model</div>
          <div className="hint">
            {note ??
              (downloaded
                ? `${s!.version} · ${(s!.bytes / 1024 / 1024).toFixed(0)} MB · downloaded`
                : 'Not downloaded — fetch the on-device voice (~92 MB, one time). Until then the spoken summary uses your system voice.')}
            {busy && pct != null && ` · ${pct}%`}
          </div>
        </div>
        <button className="btn ghost" onClick={() => void download()} disabled={busy}>
          {busy ? (pct != null ? `Downloading ${pct}%` : 'Downloading…') : downloaded ? 'Re-download' : 'Download model'}
        </button>
      </div>
    </>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

function Account({ auth }: { auth: AuthState | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = auth?.profile ?? null;
  const isGoogle = auth?.provider === 'google';
  const initial = (profile?.name || 'G').charAt(0).toUpperCase();

  async function connectGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-title">Account</div>
      <div className="row">
        {profile?.picture ? (
          <img className="avatar" src={profile.picture} alt="" />
        ) : (
          <div className="avatar avatar-initial">{initial}</div>
        )}
        <div className="grow">
          <div className="label">{profile?.name ?? 'Guest'}</div>
          <div className="hint">
            {isGoogle ? profile?.email : 'Guest · local to this device'}
          </div>
        </div>
        {isGoogle ? (
          <button className="btn ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : (
          <button
            className="btn google"
            onClick={() => void connectGoogle()}
            disabled={busy || !HAS_GOOGLE_OAUTH}
            title={HAS_GOOGLE_OAUTH ? 'Connect your Google account' : 'Set a Google client id in src/config.ts'}
          >
            <GoogleIcon />
            {busy ? 'Connecting…' : 'Connect Google'}
          </button>
        )}
      </div>
      {error && <div className="row hint" style={{ color: 'var(--drift-bad-soft)' }}>{error}</div>}
    </>
  );
}

// Account + preferences. Writes straight through to chrome.storage; the store
// subscription re-renders the rest of the app.
export function Settings({
  auth,
  settings,
  onBack,
}: {
  auth: AuthState | null;
  settings: SettingsT;
  onBack: () => void;
}) {
  async function clearData() {
    await chrome.storage.local.clear();
  }

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <button className="iconbtn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings">
        <Account auth={auth} />

        <div className="section-title">Behavior</div>
        <div className="row">
          <div className="grow">
            <div className="label">Ask before acting</div>
            <div className="hint">Confirm before any action runs on your behalf.</div>
          </div>
          <Switch
            on={settings.askBeforeActing}
            onChange={(v) => void patchSettings({ askBeforeActing: v })}
          />
        </div>
        <div className="row">
          <div className="grow">
            <div className="label">Appearance</div>
            <div className="hint">Match the system theme or force one.</div>
          </div>
          <select
            className="model-select"
            value={settings.theme}
            onChange={(e) => void patchSettings({ theme: e.target.value as ThemePref })}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <ScannerRow settings={settings} />

        <VoiceEngineRow settings={settings} />

        <div className="section-title">Data</div>
        <div className="row" style={{ borderBottom: 'none' }}>
          <div className="grow">
            <div className="label">Clear local data</div>
            <div className="hint">Removes saved reports and downloaded files from this browser.</div>
          </div>
          <button className="btn ghost" onClick={() => void clearData()}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
