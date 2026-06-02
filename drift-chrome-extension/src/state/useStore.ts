// Reactive store for the side panel: account + settings. Reads initial state
// from chrome.storage and stays in sync via storage-change listeners.

import { useEffect, useState } from 'react';
import { getAuth, onAuthChange, type AuthState } from '../auth/google';
import { DEFAULT_SETTINGS, getSettings, onSettingsChange, type Settings } from './settings';

export interface Store {
  ready: boolean;
  auth: AuthState | null;
  settings: Settings;
}

export function useStore(): Store {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    void Promise.all([getAuth(), getSettings()]).then(([a, s]) => {
      if (!active) return;
      setAuth(a);
      setSettings(s);
      setReady(true);
    });
    const offAuth = onAuthChange(setAuth);
    const offSettings = onSettingsChange(setSettings);
    return () => {
      active = false;
      offAuth();
      offSettings();
    };
  }, []);

  return { ready, auth, settings };
}
