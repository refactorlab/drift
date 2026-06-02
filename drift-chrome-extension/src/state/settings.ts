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
