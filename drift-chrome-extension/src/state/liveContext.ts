// A PrContext synthesized from a LIVE SCAN (no Drift comment on the page), kept
// per PR url so the chat can ground on it. usePrContext prefers a real scraped
// Drift comment and falls back to this — so running a live scan turns any PR
// into a conversation you can ask about, even one Drift has never touched.

import type { PrContext } from '../core/types';

const PREFIX = 'drift:livectx:';
const key = (url: string) => `${PREFIX}${url}`;

export function isLiveContextChange(
  changes: Record<string, chrome.storage.StorageChange>,
): boolean {
  return Object.keys(changes).some((k) => k.startsWith(PREFIX));
}

export async function setLiveContext(ctx: PrContext): Promise<void> {
  await chrome.storage.local.set({ [key(ctx.pr.url)]: ctx });
}

export async function getLiveContext(url: string): Promise<PrContext | null> {
  const k = key(url);
  return ((await chrome.storage.local.get(k))[k] as PrContext | undefined) ?? null;
}

export async function clearLiveContext(url: string): Promise<void> {
  await chrome.storage.local.remove(key(url));
}
