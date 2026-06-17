// PR identity for the side panel derived purely from the ACTIVE TAB URL — no
// Drift comment required, so the live scanner works on ANY pull request (even
// one Drift has never touched). This is intentionally separate from
// usePrContext (which scrapes the Drift comment for the chat grounding).

import { useEffect, useState } from 'react';
import { activeTab } from '../core/messaging';
import { parsePrUrl, type PrId } from '../core/prRefs';
import { GITHUB_NAV_FILTER } from '../core/githubHost';

/** The PR the active GitHub tab is on, or null. Refreshes on tab/nav changes. */
export function useActivePr(): PrId | null {
  const [pr, setPr] = useState<PrId | null>(null);

  useEffect(() => {
    let live = true;
    let sig = 'init';

    const refresh = async () => {
      let next: PrId | null = null;
      try {
        const tab = await activeTab();
        next = tab?.url ? parsePrUrl(tab.url) : null;
      } catch {
        next = null;
      }
      const s = next ? `${next.host}/${next.owner}/${next.repo}#${next.number}` : 'none';
      if (live && s !== sig) {
        sig = s;
        setPr(next);
      }
    };

    void refresh();
    const onTab = () => void refresh();
    chrome.tabs?.onActivated.addListener(onTab);
    chrome.tabs?.onUpdated.addListener(onTab);
    chrome.webNavigation?.onHistoryStateUpdated.addListener(onTab, GITHUB_NAV_FILTER);
    chrome.webNavigation?.onCompleted.addListener(onTab, GITHUB_NAV_FILTER);
    const poll = window.setInterval(() => void refresh(), 3000);

    return () => {
      live = false;
      window.clearInterval(poll);
      chrome.tabs?.onActivated.removeListener(onTab);
      chrome.tabs?.onUpdated.removeListener(onTab);
      chrome.webNavigation?.onHistoryStateUpdated.removeListener(onTab);
      chrome.webNavigation?.onCompleted.removeListener(onTab);
    };
  }, []);

  return pr;
}
