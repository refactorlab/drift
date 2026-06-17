// Standalone extension page whose sole job is to obtain the microphone grant in
// a context where Chrome reliably shows the permission prompt.
//
// WHY THIS EXISTS: getUserMedia() called from the side panel produces a
// permission prompt that is anchored to the underlying tab and gets
// auto-dismissed ("NotAllowedError: Permission dismissed") — the side panel is
// not a top-level browsing context, so it can't host the prompt. A *top-level*
// extension page (this page, opened in its own popup window) shows the prompt
// normally. Chrome stores the grant against the extension origin
// (chrome-extension://<id>), which the side panel shares — so once it's granted
// here, the side panel's getUserMedia succeeds silently from then on.
//
// See ensureMicPermission() in ../core/micPermission.ts for the caller side.

import type { Message } from '../core/messaging';

const msgEl = document.getElementById('msg') as HTMLParagraphElement;
const retryBtn = document.getElementById('retry') as HTMLButtonElement;

function report(message: Message): void {
  // Fire-and-forget broadcast to the side panel listener. Swallow the
  // "receiving end does not exist" lastError if the panel already closed.
  try {
    chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
  } catch {
    /* extension context gone */
  }
}

async function requestMic(): Promise<void> {
  retryBtn.hidden = true;
  msgEl.textContent = 'Requesting microphone access…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    // We only needed the grant — release the device immediately.
    for (const t of stream.getTracks()) t.stop();
    msgEl.textContent = 'Microphone enabled. You can close this window.';
    report({ type: 'MIC_PERMISSION_RESULT', ok: true });
    // Let the "remember this decision" grant persist before we go away.
    setTimeout(() => window.close(), 500);
  } catch (err) {
    // Don't signal failure to the side panel here — the panel keeps waiting
    // while this popup is open. A dismissed auto-attempt simply falls back to
    // an explicit click (which Chrome always honors as a user gesture); a hard
    // denial is recoverable via the address-bar icon. The panel only gives up
    // if the user closes this window without granting.
    const message = err instanceof Error ? err.message : 'Microphone unavailable';
    msgEl.textContent =
      `Microphone blocked (${message}). Click "Enable microphone" below; if that ` +
      `keeps failing, allow it via the 🎙️/🔒 icon in the address bar.`;
    retryBtn.hidden = false;
  }
}

retryBtn.addEventListener('click', () => void requestMic());

// Auto-attempt on load: a freshly opened top-level window can prompt without an
// explicit click in most setups. If the browser declines (e.g. it wants a user
// gesture, or the origin is blocked), the retry button gives an explicit one.
void requestMic();
