// Reactive settings store for the side panel. Reads initial state from
// chrome.storage and stays in sync via storage-change listeners so multiple
// panels / windows agree.

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, onSettingsChange, type Settings } from './settings';

export interface Store {
  ready: boolean;
  settings: Settings;
}

export function useStore(): Store {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    void getSettings().then((s) => {
      if (!active) return;
      setSettings(s);
      setReady(true);
    });
    const offSettings = onSettingsChange(setSettings);
    return () => {
      active = false;
      offSettings();
    };
  }, []);

  return { ready, settings };
}
