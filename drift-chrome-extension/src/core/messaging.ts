// Typed message bus between content script, popup, side panel and the
// background service worker. One discriminated union keeps both ends honest.

import type { DriftReport, PrContext } from './types';
import type { PrRefs } from './prRefs';

/** Result of a background-worker attempt to download an artifact from GitHub. */
export interface FetchedArtifact {
  ok: boolean;
  status?: number;
  contentType?: string | null;
  /** Decoded JSON/text (unzipped if the artifact was a zip); null on error. */
  text?: string | null;
  /**
   * Base64 `data:` URL for binary artifacts (audio), set only when the request
   * asked for `binary`. Lets the side panel feed it straight into an <audio>.
   */
  dataUrl?: string | null;
  /** MIME type inferred for a binary artifact, e.g. "audio/mpeg". */
  mime?: string | null;
  /** Raw downloaded size in bytes (zip size before extraction). */
  bytes?: number;
  /** Name of the entry extracted from the zip, when applicable. */
  filename?: string;
  error?: string;
}

export type Message =
  | { type: 'GET_REPORT' } // popup/sidepanel → content: scrape & return
  | { type: 'GET_CONTEXT' } // sidepanel → content: scrape full PR context
  | { type: 'GET_PR_REFS' } // sidepanel → content: read base/head refs off the live DOM
  | { type: 'REPORT'; report: DriftReport } // content → background cache
  | { type: 'OPEN_SIDE_PANEL'; tabId?: number } // any → background
  | { type: 'FETCH_ARTIFACT'; url: string; binary?: boolean } // sidepanel → background: credentialed download (binary → audio data URL)
  | { type: 'PING' };

export type Response =
  | { ok: true; report: DriftReport }
  | { ok: true; context: PrContext | null }
  | { ok: true; refs: PrRefs | null }
  | { ok: true; fetched: FetchedArtifact }
  | { ok: true }
  | { ok: false; error: string };

export function sendToTab(tabId: number, msg: Message): Promise<Response> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (res?: Response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message ?? 'no content script' });
      else resolve(res ?? { ok: false, error: 'no response' });
    });
  });
}

export function sendToRuntime(msg: Message): Promise<Response> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res?: Response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message ?? 'runtime error' });
      else resolve(res ?? { ok: false, error: 'no response' });
    });
  });
}

export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const STORAGE_KEY = 'drift:last-report';

export async function cacheReport(report: DriftReport): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: report });
}

export async function readCachedReport(): Promise<DriftReport | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as DriftReport | undefined) ?? null;
}
