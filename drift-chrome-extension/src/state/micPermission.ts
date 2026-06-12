// Shared mic-grant state for the live voice agent.
//
// MV3 reality (see GoogleChrome/chrome-extensions-samples#821): `getUserMedia`
// CANNOT surface Chrome's permission prompt from a side panel, and a grant made
// in a separate extension TAB does NOT reliably carry over to the side panel.
// The pattern that works is a same-origin <iframe allow="microphone"> embedded in
// the panel pointing at the page below: the prompt is anchored to the panel, the
// grant attaches to the extension ORIGIN, and the panel then captures with no
// further prompt. We mirror the result into storage so a later session can skip
// the iframe entirely when the live Permissions API isn't conclusive.

export const MIC_GRANTED_KEY = 'drift:micGranted';
export const PERMISSION_PAGE = 'src/permission/index.html';

/** postMessage type the embedded permission iframe posts up to the panel. */
export const MIC_GRANT_MESSAGE = 'drift:mic-grant-result';
export interface MicGrantMessage {
  type: typeof MIC_GRANT_MESSAGE;
  granted: boolean;
}

/** Absolute extension URL of the permission page (for the embedded iframe / a tab). */
export function permissionUrl(): string {
  return chrome.runtime.getURL(PERMISSION_PAGE);
}

/** Our cached grant flag — only a hint; the live `getUserMedia` is the truth. */
export async function isMicGranted(): Promise<boolean> {
  const v = await chrome.storage.local.get(MIC_GRANTED_KEY);
  return v[MIC_GRANTED_KEY] === true;
}

/**
 * Live mic-permission state via the Permissions API, when available.
 * Returns 'granted' | 'denied' | 'prompt', or null if the query is unsupported
 * (some Chrome builds reject `name: 'microphone'` in extension pages — fall back
 * to attempting capture).
 */
export async function queryMicPermission(): Promise<PermissionState | null> {
  try {
    // `microphone` isn't in the TS PermissionName union but Chromium supports it.
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

/**
 * True when the error from `getUserMedia` means "permission/device", i.e. a grant
 * flow can fix it — as opposed to a worklet/wasm/AudioContext failure, which must
 * be surfaced verbatim instead of being mislabeled "mic blocked".
 */
export function isMicPermissionError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return (
    e.name === 'NotAllowedError' || // user denied / dismissed, or no grant yet
    e.name === 'SecurityError' || // blocked by permissions policy / insecure ctx
    e.name === 'NotFoundError' || // no mic device
    e.name === 'NotReadableError' // device busy / OS-level block
  );
}

/** Last-resort fallback: open the grant page as a full tab (no `tabs` perm needed). */
export function openPermissionTab(): void {
  chrome.tabs.create({ url: permissionUrl() });
}
