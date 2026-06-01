// Persisted user settings + onboarding flag, stored in chrome.storage.local.

export type ThemePref = 'system' | 'dark' | 'light';

export interface Settings {
  onboarded: boolean;
  askBeforeActing: boolean;
  theme: ThemePref;
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
