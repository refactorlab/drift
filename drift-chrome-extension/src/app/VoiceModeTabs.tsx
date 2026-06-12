import { patchSettings } from '../state/settings';

// The switch between the two voice experiences: Dial's hosted phone call and the
// browser-orchestrated mic agent. Persisted so the Voice view reopens in the same
// mode. Shared by Voice.tsx and PhoneCall.tsx so the control looks identical in both.
export function VoiceModeTabs({ mode }: { mode: 'phone' | 'browser' }) {
  return (
    <div className="voice-mode-tabs" role="tablist" aria-label="Voice mode">
      <button
        role="tab"
        aria-selected={mode === 'phone'}
        className={`voice-mode-tab ${mode === 'phone' ? 'active' : ''}`}
        onClick={() => void patchSettings({ voiceMode: 'phone' })}
        title="Dial places a real phone call — Andy calls your phone"
      >
        📞 Phone call
      </button>
      <button
        role="tab"
        aria-selected={mode === 'browser'}
        className={`voice-mode-tab ${mode === 'browser' ? 'active' : ''}`}
        onClick={() => void patchSettings({ voiceMode: 'browser' })}
        title="Talk to Andy in the browser with your mic (Cloudflare + local brain)"
      >
        🎙 In browser
      </button>
    </div>
  );
}
