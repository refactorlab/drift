// Guarantees the extension holds a microphone grant before the side panel tries
// to capture. The side panel itself can't reliably host the getUserMedia prompt
// (it gets auto-dismissed as "Permission dismissed"), so when the grant is
// missing we hand the request off to a top-level popup window — see
// ../permission/main.ts for the full explanation.

import type { Message } from './messaging';

// Built output path mirrors how side_panel uses 'src/sidepanel/index.html'.
const PERMISSION_PAGE = 'src/permission/index.html';

/** The mic permission state for the extension origin, or 'unknown' if the
 *  Permissions API can't answer (older Chrome / unsupported name). */
async function micPermissionState(): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Resolve once the extension can capture the mic. Opens the helper popup ONLY
 * when the grant is genuinely missing — so after the user allows it once, every
 * later voice session is silent (no repeat popup).
 */
export async function ensureMicPermission(): Promise<void> {
  // Fast path: the Permissions API already says we hold the grant.
  if ((await micPermissionState()) === 'granted') return;

  // The Permissions API is unreliable in a side panel: it can report 'prompt'
  // even after a persisted grant, which would re-open the popup every session.
  // So actually PROBE getUserMedia — a granted mic resolves instantly with no
  // prompt. If it succeeds, the grant exists; release the device and return
  // without ever showing the popup. (startCapture re-acquires the real stream.)
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    for (const t of probe.getTracks()) t.stop();
    return;
  } catch {
    // Genuinely not granted (or the side panel can't host the prompt) → fall
    // through to the popup, which CAN prompt and persists the grant at the origin.
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let windowId: number | undefined;

    const cleanup = () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.windows.onRemoved.removeListener(onClosed);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (windowId !== undefined) chrome.windows.remove(windowId).catch(() => void 0);
      resolve();
    };

    // On failure keep the popup open so the user can read the recovery
    // instructions and re-enable the mic in site settings.
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const onMessage = (msg: Message) => {
      if (msg?.type !== 'MIC_PERMISSION_RESULT') return;
      if (msg.ok) succeed();
      else fail(msg.error || 'Microphone permission denied');
    };

    const onClosed = (id: number) => {
      if (id === windowId) fail('Microphone permission was not granted');
    };

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.windows.onRemoved.addListener(onClosed);

    chrome.windows.create(
      {
        url: chrome.runtime.getURL(PERMISSION_PAGE),
        type: 'popup',
        width: 440,
        height: 280,
        focused: true,
      },
      (win) => {
        windowId = win?.id;
        if (chrome.runtime.lastError) fail(chrome.runtime.lastError.message || 'Could not open permission window');
      },
    );
  });
}
