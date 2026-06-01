import { patchSettings, type Settings as SettingsT, type ThemePref } from '../state/settings';

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

// Preferences. Writes straight through to chrome.storage; the store
// subscription re-renders the rest of the app.
export function Settings({ settings, onBack }: { settings: SettingsT; onBack: () => void }) {
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
