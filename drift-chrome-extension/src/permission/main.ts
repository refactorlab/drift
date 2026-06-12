// Mic-permission bootstrap. getUserMedia can't surface Chrome's permission prompt
// from a side panel, so the Voice view embeds THIS page as a same-origin
// <iframe allow="microphone">. The prompt is anchored to the panel; on allow the
// grant attaches to the extension ORIGIN, so afterward the panel captures with no
// prompt. We post the result up to the parent panel AND record a storage flag so a
// later session can skip re-prompting. (Also works when opened as a full tab.)

import { MIC_GRANTED_KEY, MIC_GRANT_MESSAGE } from '../state/micPermission';

const status = document.getElementById('status')!;

function report(granted: boolean): void {
  void chrome.storage.local.set({ [MIC_GRANTED_KEY]: granted });
  // Notify the embedding panel (no-op when this page is a standalone tab).
  if (window.parent !== window) {
    window.parent.postMessage({ type: MIC_GRANT_MESSAGE, granted }, '*');
  }
}

async function requestMic(): Promise<void> {
  status.textContent = 'Requesting microphone access…';
  status.className = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // we only needed the grant
    report(true);
    status.textContent = '✓ Microphone enabled. You can start talking to Andy now.';
    status.className = 'ok';
  } catch {
    report(false);
    status.textContent =
      'Microphone access was blocked. Click the camera/mic icon in the address bar to allow it, then press “Try again”.';
    status.className = 'err';
  }
}

document.getElementById('retry')!.addEventListener('click', () => void requestMic());
void requestMic();
