// Active PR context for the side panel. Two sources, combined for robustness:
//   1. a LIVE query to the active tab's content script (authoritative), and
//   2. chrome.storage.local (written by the content script; survives races and
//      lets storage-change events refresh the panel).

import { useEffect, useState } from 'react';
import type { PrContext } from '../core/types';
import { activeTab, sendToTab } from '../core/messaging';

// Everything is scoped to a specific PR URL.
const PR_PREFIX = 'drift:pr:';
const prKey = (url: string) => `${PR_PREFIX}${url}`;

/** Persist the loaded report for a specific PR url. */
export async function setPrContext(ctx: PrContext): Promise<void> {
  await chrome.storage.local.set({ [prKey(ctx.pr.url)]: ctx });
}

export async function getSavedPrContext(url: string): Promise<PrContext | null> {
  const k = prKey(url);
  return ((await chrome.storage.local.get(k))[k] as PrContext | undefined) ?? null;
}

/**
 * Delete everything saved for this PR: the loaded report + every downloaded
 * artifact's cached content + its disk-download record.
 */
export async function clearPrData(ctx: PrContext): Promise<void> {
  const keys = [prKey(ctx.pr.url)];
  for (const a of ctx.artifacts) {
    if (a.url) keys.push(`drift:artifact:${a.url}`, `drift:download:${a.url}`);
  }
  await chrome.storage.local.remove(keys);
}

export function onPrContextChange(cb: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && Object.keys(changes).some((k) => k.startsWith(PR_PREFIX))) cb();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Stable signature so we only re-render when the context meaningfully changes. */
function signature(ctx: PrContext | null): string {
  if (!ctx) return 'none';
  return [
    ctx.pr.url,
    ctx.report.verdictLabel,
    ctx.report.metricCount,
    ctx.artifacts.map((a) => `${a.name}:${a.url ?? ''}`).join(','),
  ].join('|');
}

/** Ask the active GitHub tab's content script for a fresh scrape. */
async function liveContextFromTab(): Promise<PrContext | null> {
  try {
    const tab = await activeTab();
    if (!tab?.id || !tab.url?.includes('github.com')) return null;
    const res = await sendToTab(tab.id, { type: 'GET_CONTEXT' });
    if (res.ok && 'context' in res) return res.context;
  } catch {
    /* content script not present on this tab */
  }
  return null;
}

/**
 * React hook: context for the ACTIVE tab, kept in sync as the user navigates.
 *
 * We query the active tab's content script live (authoritative for "what page
 * am I on"). We deliberately do NOT fall back to stored context — otherwise
 * navigating away from the PR would leave stale chips. Refreshes fire on tab
 * switch, navigation, and when the content script writes (storage change).
 */
export function usePrContext() {
  const [ctx, setCtx] = useState<PrContext | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let sig = 'init';

    const refresh = async () => {
      const live = await liveContextFromTab();
      const next = signature(live);
      // Only update when something actually changed — prevents render churn
      // (and stream restarts) on every GitHub DOM mutation / tab event.
      if (active && next !== sig) {
        sig = next;
        setCtx(live);
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 150);
    };

    void refresh();

    const offStorage = onPrContextChange(schedule);
    const onActivated = () => schedule();
    const onUpdated = (
      _id: number,
      info: chrome.tabs.TabChangeInfo,
    ) => {
      // Re-evaluate when a tab finishes loading or its URL changes.
      if (info.status === 'complete' || info.url) schedule();
    };
    chrome.tabs?.onActivated.addListener(onActivated);
    chrome.tabs?.onUpdated.addListener(onUpdated);

    return () => {
      active = false;
      window.clearTimeout(timer);
      offStorage();
      chrome.tabs?.onActivated.removeListener(onActivated);
      chrome.tabs?.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // Clear all saved data for the current PR (report + downloaded files).
  const clear = async () => {
    if (ctx) await clearPrData(ctx);
  };
  return { ctx, clear };
}
