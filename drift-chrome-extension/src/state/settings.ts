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

/** The in-browser LLM brain (Qwen via WebLLM) acquired on this device. Unlike
 *  the scanner/TTS the model lives in IndexedDB (WebLLM's own cache), so this is
 *  just the "the user downloaded it" record + version tag (model id). */
export interface BrainMeta {
  /** WebLLM model id (e.g. Qwen2.5-1.5B-Instruct-q4f16_1-MLC). */
  version: string;
  /** Advertised model size in bytes, for display. */
  bytes: number;
  source: 'remote';
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
  /** Whether the change-impact diagram plays soft reveal ticks in TEXT mode. Default
   *  on. (Voice mode always plays them — the diagram rides along with the spoken
   *  walkthrough — so this only gates the typed experience.) */
  graphSoundEnabled?: boolean;
  /** Acquired in-browser LLM brain (set when the user downloads the model). */
  brain?: BrainMeta;
  /** Custom system prompt / persona for the chat brain (optional override). */
  persona?: string;
  /** Which chat brain to use: 'local' = on-device Qwen/WebLLM (default);
   *  'gemini' = the Gemini API on a BYO key. */
  brainMode?: 'local' | 'gemini';
  /** BYO Gemini API key (free tier — aistudio.google.com). Stored locally in
   *  chrome.storage; never bundled or committed. */
  geminiApiKey?: string;
  /** Gemini model id (defaults to a free-tier Flash; see geminiBrain.ts). */
  geminiModel?: string;
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
