import { useEffect, useState } from 'react';
import { useStore } from '../state/useStore';
import { patchSettings } from '../state/settings';
import { purgeDerivedCache } from '../state/artifacts';
import { signInAsGuest } from '../auth/google';
import { Onboarding } from './Onboarding';
import { ensureScanner, prewarmScanner } from '../core/scannerStore';
import { ensureTts } from '../core/ttsStore';
import { Chat } from './Chat';
import { Settings } from './Settings';
import { Context } from './Context';
import { LivePipelineRun } from './LivePipelineRun';
import '../ui/theme.css';
import './app.css';

type View = 'chat' | 'settings' | 'context' | 'pipeline';

export function App() {
  const { ready, auth, settings } = useStore();
  const [view, setView] = useState<View>('chat');

  // Default to a local guest account so the user is always "connected" (shown
  // in Settings) — no forced sign-in. Google is an optional upgrade.
  useEffect(() => {
    if (ready && !auth) void signInAsGuest();
  }, [ready, auth]);

  // One-time: clear any legacy derived/scraped artifact cache from old builds.
  useEffect(() => {
    void purgeDerivedCache();
  }, []);

  // Returning users who already onboarded still get a silent scanner check on
  // launch, so a new bundled wasm version is re-acquired/recorded without a
  // visible step. First-time install acquires it visibly in Onboarding instead.
  // The voice engine is re-checked the same way (best-effort, fail-soft): a new
  // bundled/remote Kokoro version is picked up silently; when it isn't staged
  // the spoken summary just keeps using the system voice.
  useEffect(() => {
    if (ready && settings.onboarded) {
      void ensureScanner().catch(() => {});
      prewarmScanner(); // compile the wasm in the background so the first scan is instant
      if (settings.ttsEnabled !== false) void ensureTts().catch(() => {});
    }
  }, [ready, settings.onboarded, settings.ttsEnabled]);

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

  if (view === 'settings') {
    return <Settings auth={auth} settings={settings} onBack={() => setView('chat')} />;
  }
  if (view === 'context') {
    return <Context onBack={() => setView('chat')} />;
  }
  if (view === 'pipeline') {
    return <LivePipelineRun onBack={() => setView('chat')} />;
  }
  return (
    <Chat
      settings={settings}
      onOpenSettings={() => setView('settings')}
      onOpenContext={() => setView('context')}
      onOpenPipeline={() => setView('pipeline')}
    />
  );
}
