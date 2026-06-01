import { useEffect, useState } from 'react';
import { useStore } from '../state/useStore';
import { patchSettings } from '../state/settings';
import { purgeDerivedCache } from '../state/artifacts';
import { Onboarding } from './Onboarding';
import { Chat } from './Chat';
import { Settings } from './Settings';
import { Context } from './Context';
import '../ui/theme.css';
import './app.css';

type View = 'chat' | 'settings' | 'context';

export function App() {
  const { ready, settings } = useStore();
  const [view, setView] = useState<View>('chat');

  // One-time: clear any legacy derived/scraped artifact cache from old builds.
  useEffect(() => {
    void purgeDerivedCache();
  }, []);

  // Apply the theme preference to the document root.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = settings.theme;
    el.style.colorScheme = settings.theme === 'system' ? 'light dark' : settings.theme;
  }, [settings.theme]);

  if (!ready) {
    return (
      <div className="drift-app drift-root">
        <div className="center-screen">
          <div className="mark-lg" />
        </div>
      </div>
    );
  }

  if (!settings.onboarded) {
    return (
      <div className="drift-app drift-root">
        <Onboarding onDone={() => void patchSettings({ onboarded: true })} />
      </div>
    );
  }

  // No sign-in — the app opens straight into the chat and uses the browser's
  // existing GitHub session for downloads.
  if (view === 'settings') {
    return <Settings settings={settings} onBack={() => setView('chat')} />;
  }
  if (view === 'context') {
    return <Context onBack={() => setView('chat')} />;
  }
  return (
    <Chat
      settings={settings}
      onOpenSettings={() => setView('settings')}
      onOpenContext={() => setView('context')}
    />
  );
}
