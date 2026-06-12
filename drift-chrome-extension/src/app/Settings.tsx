import { useEffect, useState } from 'react';
import { signInWithGoogle, signOut, type AuthState } from '../auth/google';
import { HAS_GOOGLE_OAUTH } from '../config';
import { patchSettings, type Settings as SettingsT, type ThemePref } from '../state/settings';
import { ensureScanner } from '../core/scannerStore';
import { downloadTts } from '../core/ttsStore';
import { KOKORO_VOICE_SID, DEFAULT_VOICE } from '../core/ttsProvider';
import { GoogleIcon } from './GoogleIcon';
import { getHistory, clearHistoryForPr, type ScanRecord } from '../state/scanHistory';
import { removeSpokenAudioForUrl } from '../state/spokenAudio';
import { AURA_SPEAKERS, DEFAULT_SPEAKER } from '../core/cfVoice';
import { DEFAULT_BRAIN_URL, DEFAULT_VOICE_MODEL, VOICE_MODELS } from '../core/voiceBrain';
import { listNumbers, type DialNumber } from '../core/dialVoice';

// The live-scan engine dependency: shows the acquired wasm version + source.
//   • "Check for update" re-verifies the BUNDLED build (the store-compliant
//     default that ships in the package).
//   • "Download latest" is the OPTIONAL override — it pulls the prebuilt wasm
//     from the GitHub release and caches it on-device, so this device runs the
//     latest scanner without waiting for a Web Store update. (Remote wasm isn't
//     the store default — MV3 forbids remote code — so this is a dev/sideload
//     affordance.) Once downloaded, every scan uses the cached build.
function ScannerRow({ settings }: { settings: SettingsT }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const s = settings.scanner;
  const downloaded = s?.source === 'remote';

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

  async function download() {
    // STORE BUILD GUARD: __DRIFT_STORE_BUILD__ is statically `true` in the
    // Web Store build, so everything below is dead-code-eliminated and the
    // remote-download module (scannerDownload.ts) never enters the bundle.
    if (__DRIFT_STORE_BUILD__) return;
    setBusy(true);
    setNote(null);
    setPct(0);
    try {
      // Dynamic import so the store build (where this line is unreachable) drops
      // the module entirely — keeps fetch-remote-wasm code out of the package.
      const { downloadScanner } = await import('../core/scannerDownload');
      const r = await downloadScanner((p) => {
        setNote(p.phase);
        setPct(p.fraction != null ? Math.round(p.fraction * 100) : null);
      });
      setNote(r.status === 'ready' ? `Up to date · v${r.meta.version}` : `${r.status} · v${r.meta.version}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPct(null);
    }
  }

  return (
    <>
      <div className="section-title">Scan engine</div>
      <div className="row">
        <div className="grow">
          <div className="label">Static drift profiler (WASM)</div>
          <div className="hint">
            {note ??
              (s
                ? `v${s.version} · ${(s.bytes / 1024 / 1024).toFixed(1)} MB · ${s.source}`
                : 'Not acquired yet')}
            {busy && pct != null && ` · ${pct}%`}
          </div>
        </div>
        <button className="btn ghost" onClick={() => void recheck()} disabled={busy}>
          {busy && pct == null ? 'Checking…' : 'Check for update'}
        </button>
      </div>
      {/* DEV/SIDELOAD ONLY. __DRIFT_STORE_BUILD__ is statically true in the
          store build, so this whole row is dead-code-eliminated and never
          renders — the shipping package has no remote-download affordance. */}
      {!__DRIFT_STORE_BUILD__ && (
        <div className="row" style={{ borderBottom: 'none' }}>
          <div className="grow">
            <div className="label">Latest from release</div>
            <div className="hint">
              Download the newest scanner from the Drift release and run it on this device.
            </div>
          </div>
          <button className="btn ghost" onClick={() => void download()} disabled={busy}>
            {busy && pct != null ? (pct ? `Downloading ${pct}%` : 'Downloading…') : downloaded ? 'Re-download' : 'Download latest'}
          </button>
        </div>
      )}
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

// A write-through text field: controlled local state keeps the display in sync
// with external settings changes (e.g. "Clear all"), and every edit persists
// immediately — so a value isn't lost if the user leaves without blurring.
function PersistedInput({
  value,
  onSave,
  type = 'text',
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]); // resync when storage changes elsewhere
  return (
    <input
      className="text-input"
      type={type}
      spellCheck={false}
      placeholder={placeholder}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onSave(e.target.value.trim());
      }}
    />
  );
}

// The live voice agent (browser-orchestrated): the side panel runs the turn loop
// locally, using Cloudflare Workers AI (BYO token) for speech-to-text and
// text-to-speech, and the local drift-brain for Claude. These fields are the
// user's own credentials, stored only on this device.
function VoiceAgentRow({ settings }: { settings: SettingsT }) {
  const speaker = settings.voiceSpeaker || DEFAULT_SPEAKER;
  const model = settings.voiceModel || DEFAULT_VOICE_MODEL;
  return (
    <>
      <div className="section-title">Live voice agent</div>
      <div className="row">
        <div className="grow">
          <div className="label">Brain model</div>
          <div className="hint">The Claude model Andy thinks with. Opus is most capable; Haiku is fastest for live.</div>
        </div>
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
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Cloudflare account id</div>
          <div className="hint">From the Workers AI dashboard. Used for speech-to-text and text-to-speech.</div>
        </div>
        <PersistedInput
          placeholder="account id"
          value={settings.voiceCfAccountId ?? ''}
          onSave={(v) => void patchSettings({ voiceCfAccountId: v })}
        />
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Workers AI API token</div>
          <div className="hint">A token scoped to Workers AI. Stored only on this device.</div>
        </div>
        <PersistedInput
          type="password"
          placeholder="api token"
          value={settings.voiceCfApiToken ?? ''}
          onSave={(v) => void patchSettings({ voiceCfApiToken: v })}
        />
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Andy’s voice</div>
          <div className="hint">Deepgram Aura speaker used for the spoken replies.</div>
        </div>
        <select
          className="model-select"
          value={speaker}
          onChange={(e) => void patchSettings({ voiceSpeaker: e.target.value })}
        >
          {AURA_SPEAKERS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="row" style={{ borderBottom: 'none' }}>
        <div className="grow">
          <div className="label">Brain endpoint</div>
          <div className="hint">
            The local drift-brain (Claude via your subscription). Run <code>npm start</code> in
            <code> drift-brain/</code>.
          </div>
        </div>
        <PersistedInput
          placeholder={DEFAULT_BRAIN_URL}
          value={settings.voiceBrainUrl ?? ''}
          onSave={(v) => void patchSettings({ voiceBrainUrl: v })}
        />
      </div>
    </>
  );
}

// The Dial phone-call agent (fully hosted): Dial places a REAL outbound call and
// runs the whole conversation (STT, TTS, LLM) on their side — the opposite of the
// browser agent above. The user supplies their Dial API key; we list their numbers
// to pick the "from" number. All BYO, stored only on this device.
function DialCallRow({ settings }: { settings: SettingsT }) {
  const [numbers, setNumbers] = useState<DialNumber[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const apiKey = settings.dialApiKey?.trim() ?? '';
  const gender = settings.dialVoiceGender ?? 'female';

  async function refresh(key: string) {
    if (!key) {
      setNumbers(null);
      setNote(null);
      return;
    }
    setLoading(true);
    setNote(null);
    try {
      const ns = await listNumbers(key);
      setNumbers(ns);
      setNote(ns.length ? `${ns.length} number(s) on your account` : 'No numbers on this account yet.');
      // Auto-select when there's exactly one and none is chosen.
      if (!settings.dialFromNumberId && ns.length === 1) {
        void patchSettings({ dialFromNumberId: ns[0].id });
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
      setNumbers(null);
    } finally {
      setLoading(false);
    }
  }

  // Load numbers whenever a key is present (on mount and after it changes).
  useEffect(() => {
    void refresh(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <>
      <div className="section-title">Phone call (Dial)</div>
      <div className="row">
        <div className="grow">
          <div className="label">Dial API key</div>
          <div className="hint">
            Your <code>sk_live_…</code> key from getdial.ai. Dial does the speech and the conversation. Stored only on
            this device.
          </div>
        </div>
        <PersistedInput
          type="password"
          placeholder="sk_live_…"
          value={settings.dialApiKey ?? ''}
          onSave={(v) => void patchSettings({ dialApiKey: v })}
        />
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Call from</div>
          <div className="hint">{loading ? 'Loading your Dial numbers…' : note ?? 'The Dial number Andy calls from.'}</div>
        </div>
        {numbers && numbers.length > 0 ? (
          <select
            className="model-select"
            value={settings.dialFromNumberId ?? ''}
            onChange={(e) => void patchSettings({ dialFromNumberId: e.target.value })}
          >
            <option value="" disabled>
              choose a number
            </option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.number}
                {n.nickname ? ` · ${n.nickname}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <button className="btn ghost" disabled={!apiKey || loading} onClick={() => void refresh(apiKey)}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Call this phone</div>
          <div className="hint">The number Andy calls (your phone), in E.164 — e.g. +14155550123.</div>
        </div>
        <PersistedInput
          placeholder="+14155550123"
          value={settings.dialToNumber ?? ''}
          onSave={(v) => void patchSettings({ dialToNumber: v })}
        />
      </div>
      <div className="row">
        <div className="grow">
          <div className="label">Voice</div>
          <div className="hint">The voice Dial's agent speaks with on the call.</div>
        </div>
        <select
          className="model-select"
          value={gender}
          onChange={(e) => void patchSettings({ dialVoiceGender: e.target.value as 'male' | 'female' })}
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>
      <div className="row" style={{ borderBottom: 'none' }}>
        <div className="grow">
          <div className="label">Language</div>
          <div className="hint">BCP-47 tag to pin the call (e.g. en-US). Leave blank to let Dial auto-detect.</div>
        </div>
        <PersistedInput
          placeholder="auto-detect"
          value={settings.dialLanguage ?? ''}
          onSave={(v) => void patchSettings({ dialLanguage: v })}
        />
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

// Coarse "x ago" for the saved-scan rows.
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface ScanGroup {
  url: string;
  title: string;
  count: number;
  lastTs: number;
}

function groupByPr(records: ScanRecord[]): ScanGroup[] {
  const byUrl = new Map<string, ScanRecord[]>();
  for (const r of records) {
    const list = byUrl.get(r.url);
    if (list) list.push(r);
    else byUrl.set(r.url, [r]);
  }
  return [...byUrl.values()]
    .map((recs) => ({
      url: recs[0].url,
      title: `${recs[0].owner}/${recs[0].repo} #${recs[0].number}`,
      count: recs.length,
      lastTs: Math.max(...recs.map((r) => r.ts)),
    }))
    .sort((a, b) => b.lastTs - a.lastTs);
}

// Saved scans live in chrome.storage.local (state/scanHistory + state/spokenAudio).
// This section makes that storage visible and manageable: one row per PR, with a
// per-PR delete that drops BOTH the scan history and its cached spoken audio.
function SavedScans() {
  const [groups, setGroups] = useState<ScanGroup[] | null>(null);

  async function load() {
    setGroups(groupByPr(await getHistory()));
  }
  useEffect(() => {
    void load();
  }, []);

  async function deletePr(url: string) {
    await clearHistoryForPr(url);
    await removeSpokenAudioForUrl(url);
    await load();
  }

  if (groups == null) return null;

  return (
    <>
      <div className="section-title">Saved scans · {groups.length}</div>
      {groups.length === 0 ? (
        <div className="hint" style={{ padding: '6px 0' }}>
          No scans saved yet. Run a live scan and it’s stored here for instant replay.
        </div>
      ) : (
        groups.map((g) => (
          <div className="row" key={g.url}>
            <div className="grow">
              <div className="label">{g.title}</div>
              <div className="hint">
                {g.count} scan{g.count === 1 ? '' : 's'} · last {timeAgo(g.lastTs)}
              </div>
            </div>
            <button
              className="btn ghost danger"
              onClick={() => void deletePr(g.url)}
              title="Delete this PR's saved scans and audio"
            >
              Delete
            </button>
          </div>
        ))
      )}
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

        <DialCallRow settings={settings} />

        <VoiceAgentRow settings={settings} />

        <div className="section-title">Data</div>
        <SavedScans />
        <div className="row" style={{ borderBottom: 'none' }}>
          <div className="grow">
            <div className="label">Clear local data</div>
            <div className="hint">Removes ALL saved scans, cached audio and downloaded files from this browser.</div>
          </div>
          <button className="btn ghost danger" onClick={() => void clearData()}>
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}
