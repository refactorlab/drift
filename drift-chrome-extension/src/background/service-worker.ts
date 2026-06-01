// Background service worker (MV3). Three jobs:
//   1. Open the side panel on demand (needs a user gesture).
//   2. Toolbar click opens the side panel.
//   3. Download GitHub Actions artifacts — done HERE because an extension SW
//      with host_permissions is CORS-exempt for the signed-blob redirect. We
//      fetch with the user's GitHub session cookies and unzip the result.

import { unzipSync, strFromU8 } from 'fflate';
import type { FetchedArtifact, Message, Response as MsgResponse } from '../core/messaging';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => void 0);
});

async function downloadArtifact(url: string): Promise<FetchedArtifact> {
  console.log('[drift] download →', url);
  try {
    // Uses the browser's existing GitHub session cookies; host_permissions
    // (https://*/*) make the cross-origin signed-blob redirect CORS-readable.
    const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
    console.log('[drift] response', res.status, res.headers.get('content-type'), 'final:', res.url);
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };

    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get('content-type');
    console.log('[drift] bytes', buf.length, 'zip?', buf[0] === 0x50 && buf[1] === 0x4b);

    // ZIP magic "PK\x03\x04" — GitHub artifacts are zipped. Extract the JSON.
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      const files = unzipSync(buf);
      const names = Object.keys(files);
      console.log('[drift] zip entries', names);
      const jsonName = names.find((n) => /\.json$/i.test(n)) ?? names[0];
      if (!jsonName) return { ok: false, status: res.status, error: 'empty zip', bytes: buf.length };
      return {
        ok: true,
        status: res.status,
        contentType,
        text: strFromU8(files[jsonName]),
        bytes: buf.length,
        filename: jsonName,
      };
    }

    // Already plain JSON/text.
    return {
      ok: true,
      status: res.status,
      contentType,
      text: new TextDecoder().decode(buf),
      bytes: buf.length,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'fetch failed (CORS?)';
    console.warn('[drift] download failed', error);
    return { ok: false, error };
  }
}

chrome.runtime.onMessage.addListener(
  (msg: Message, sender, sendResponse: (r: MsgResponse) => void) => {
    if (msg.type === 'OPEN_SIDE_PANEL') {
      const tabId = msg.tabId ?? sender.tab?.id;
      const open = async () => {
        try {
          if (tabId !== undefined) {
            await chrome.sidePanel.open({ tabId });
          } else {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
          }
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      };
      void open();
      return true;
    }

    if (msg.type === 'FETCH_ARTIFACT') {
      void downloadArtifact(msg.url).then((fetched) => sendResponse({ ok: true, fetched }));
      return true; // async response
    }

    return false;
  },
);
