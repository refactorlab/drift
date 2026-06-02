// Background service worker (MV3). Three jobs:
//   1. Open the side panel on demand (needs a user gesture).
//   2. Toolbar click opens the side panel.
//   3. Download GitHub Actions artifacts — done HERE because an extension SW
//      with host_permissions is CORS-exempt for the signed-blob redirect. We
//      fetch with the user's GitHub session cookies and unzip the result.

import type { Message, Response as MsgResponse } from '../core/messaging';
import { downloadArtifact } from './download';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => void 0);
});

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
      void downloadArtifact(msg.url, msg.binary).then((fetched) => sendResponse({ ok: true, fetched }));
      return true; // async response
    }

    return false;
  },
);
