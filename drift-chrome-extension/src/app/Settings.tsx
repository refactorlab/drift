import { useState } from 'react';
import { signInWithGoogle, signOut, type AuthState } from '../auth/google';
import { HAS_GOOGLE_OAUTH } from '../config';
import { patchSettings, type Settings as SettingsT, type ThemePref } from '../state/settings';
import { GoogleIcon } from './GoogleIcon';

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
