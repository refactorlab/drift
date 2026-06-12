// Persisted user settings + onboarding flag, stored in chrome.storage.local.

export type ThemePref = 'system' | 'dark' | 'light';

/** The WASM scanner dependency that has been acquired + recorded on this device. */
export interface ScannerMeta {
  /** Version of the static drift profiler the wasm was built from (e.g. "0.8.0"). */
  version: string;
  /** Wasm byte size, for display + sanity. */
  bytes: number;
  /** Where it came from: the packaged build, or a remote URL (latest). */
  source: 'bundled' | 'remote';
  acquiredAt: number;
}

/** The Kokoro TTS engine assets acquired + recorded on this device (the audio
 *  counterpart of {@link ScannerMeta}; see core/ttsStore.ts). */
export interface TtsMeta {
  /** Version tag of the staged sherpa-onnx + Kokoro engine bundle. */
  version: string;
  /** Glue byte size (or advertised model size), for display + sanity. */
  bytes: number;
  source: 'bundled' | 'remote';
  acquiredAt: number;
}

export interface Settings {
  onboarded: boolean;
  askBeforeActing: boolean;
  theme: ThemePref;
  /** Acquired scanner dependency (set during onboarding / on version change). */
  scanner?: ScannerMeta;
  /**
   * Optional override: fetch the scanner wasm + meta from this base URL instead
   * of the packaged build — the hook for "always use the latest". When unset,
   * the bundled scanner is used.
   */
  scannerUrl?: string;
  /** Acquired Kokoro voice engine (set on first synthesis / version change). */
  tts?: TtsMeta;
  /** Remote base URL for the Kokoro engine assets (counterpart of scannerUrl). */
  ttsUrl?: string;
  /** Whether the live scan also synthesises a spoken summary. Default on. */
  ttsEnabled?: boolean;
  /** Kokoro voice name for the spoken summary (default af_heart). */
  ttsVoice?: string;

  // ─── Live voice agent (browser-orchestrated) ──────────────────────────────
  // The side panel orchestrates the turn loop locally; Cloudflare Workers AI is
  // a BYO stateless STT/TTS pair (the user's own token, scoped to Workers AI),
  // and the LLM "brain" is the local drift-brain (Claude via subscription) over
  // loopback. See docs/cloudflare-voice-agent-plan.md.
  /** Cloudflare account id for the Workers AI REST endpoint. */
  voiceCfAccountId?: string;
  /** Cloudflare API token, scoped to Workers AI (BYO; stored only on this device). */
  voiceCfApiToken?: string;
  /** drift-brain base URL (the local Claude brain). Default http://localhost:8787. */
  voiceBrainUrl?: string;
  /** Aura-1 TTS speaker for Andy's voice (default "asteria"). */
  voiceSpeaker?: string;
  /** Claude model the brain uses for voice turns (default claude-haiku-4-5 — fastest). */
  voiceModel?: string;

  // ─── Dial phone-call agent (fully hosted) ─────────────────────────────────
  // The opposite of the browser-orchestrated path above: Dial (getdial.ai) places
  // a REAL outbound phone call and runs the whole conversation — STT, TTS, and the
  // LLM — on their side. We only send the system prompt (the PR grounding) and the
  // number to dial, then poll for the transcript. No Cloudflare, no drift-brain, no
  // mic, no wasm. See docs/dial-phone-call-plan.md.
  /** Which voice experience the Voice view shows: the hosted phone call, or the
   *  browser-orchestrated mic agent. Default "phone". */
  voiceMode?: 'phone' | 'browser';
  /** Dial API key (sk_live_…). BYO; stored only on this device, never committed. */
  dialApiKey?: string;
  /** Id of the Dial number to call FROM (the account's provisioned number). */
  dialFromNumberId?: string;
  /** The phone number Andy calls (your phone), in E.164 (e.g. +14155550123). */
  dialToNumber?: string;
  /** Voice gender Dial's agent uses for the call. Default "female". */
  dialVoiceGender?: 'male' | 'female';
  /** BCP-47 language tag to pin the call to (e.g. "en-US"). Blank = Dial auto-detects. */
  dialLanguage?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  askBeforeActing: true,
  theme: 'light',
};

const KEY = 'drift:settings';

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(data[KEY] as Partial<Settings> | undefined) };
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChange(cb: (s: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && KEY in changes) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings> | undefined) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
