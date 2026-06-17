// Driving the user's BROWSER to a PR's changes — the navigation primitive the
// handover mode uses to take the reviewer to each file (and to know where they
// already are). This is the only place the extension moves a tab.
//
// GitHub renders every changed file inside a container whose id is
//   diff-<sha256(path)>
// (the `#diff-bc6c77…` anchor you see in a "Changes" URL). Setting that as the
// URL hash makes GitHub scroll straight to the file — so navigating to a file is
// just `chrome.tabs.update(tabId, { url: …/files#diff-<hash> })`. Host permission
// for https://*/* (manifest) is all that's needed to navigate; no `tabs` perm.
//
// Route is AUTO-DETECTED: the per-file anchor is identical on `/files` and the
// newer `/changes` experience, so we reuse whichever the reviewer is already on
// (default `/files`, which exists on every github.com + Enterprise host).

import { activeTab } from './messaging';
import { ghWebBase } from './githubHost';
import { parsePrUrl, type PrId } from './prRefs';

/** The diff route GitHub serves a PR's file changes on. */
export type DiffRoute = 'files' | 'changes';

/** GitHub's per-file diff anchor: `diff-` + the hex SHA-256 of the file path.
 *  Async because it uses Web Crypto (available in the panel and in Node/vitest). */
export async function diffAnchor(path: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `diff-${hex}`;
}

/** Add the precomputed `diff-…` anchor to each step so navigation + "which file
 *  is on screen" mapping are synchronous afterward. Generic over `{ path }`. */
export async function attachAnchors<T extends { path: string }>(steps: T[]): Promise<Array<T & { anchor: string }>> {
  return Promise.all(steps.map(async (s) => ({ ...s, anchor: await diffAnchor(s.path) })));
}

/** Where the active tab is within a PR — used to start the handover from the
 *  reviewer's current context ("you're already on the changes page"). */
export interface PrLocation {
  /** The PR the tab URL points at, or null when it isn't a PR page. */
  id: PrId | null;
  /** Which PR sub-page the tab is on. */
  section: 'files' | 'changes' | 'commits' | 'conversation' | 'other';
  /** The `diff-…` anchor in the URL hash (no leading `#`), or null. */
  anchor: string | null;
}

/** Parse a tab URL into PR identity + sub-page + diff anchor. Pure. */
export function parsePrLocation(tabUrl: string | undefined | null): PrLocation {
  if (!tabUrl) return { id: null, section: 'other', anchor: null };
  let u: URL;
  try {
    u = new URL(tabUrl);
  } catch {
    return { id: null, section: 'other', anchor: null };
  }
  const id = parsePrUrl(tabUrl);
  const tail = u.pathname.match(/\/pull\/\d+\/([a-z]+)/i)?.[1]?.toLowerCase();
  const section: PrLocation['section'] =
    tail === 'files'
      ? 'files'
      : tail === 'changes'
        ? 'changes'
        : tail === 'commits'
          ? 'commits'
          : id // a PR URL with no/other tail is the Conversation tab
            ? 'conversation'
            : 'other';
  const hash = u.hash.replace(/^#/, '');
  const anchor = /^diff-[0-9a-f]{6,}$/i.test(hash) ? hash : null;
  return { id, section, anchor };
}

/** The diff route to navigate to: reuse the tab's if it's already on a diff page,
 *  else `files`. Keeps the reviewer in the `/changes` experience when that's where
 *  they were. Pure. */
export function prDiffRoute(tabUrl?: string | null): DiffRoute {
  return parsePrLocation(tabUrl).section === 'changes' ? 'changes' : 'files';
}

/** The PR's diff overview URL (no file anchor). */
export function buildPrChangesUrl(pr: PrId, route: DiffRoute): string {
  return `${ghWebBase(pr.host)}/${pr.owner}/${pr.repo}/pull/${pr.number}/${route}`;
}

/** The URL that scrolls to one file's diff: the overview URL + `#diff-…`. */
export function buildPrFileUrl(pr: PrId, route: DiffRoute, anchorId: string): string {
  return `${buildPrChangesUrl(pr, route)}#${anchorId}`;
}

/** The result of a navigation attempt. `ok:false` carries a reason the AI relays. */
export interface NavResult {
  ok: boolean;
  /** The URL we navigated to (or would have). */
  url?: string;
  reason?: string;
}

/** Update the active tab to a URL built from the active tab's own context (so the
 *  route auto-detect sees the current page). Returns a relayed reason on failure. */
async function navigateActive(buildUrl: (tabUrl: string | undefined) => string): Promise<NavResult> {
  const tab = await activeTab().catch(() => undefined);
  const url = buildUrl(tab?.url ?? undefined);
  if (tab?.id == null) return { ok: false, url, reason: 'no active browser tab to navigate' };
  try {
    await chrome.tabs.update(tab.id, { url });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Navigate the active tab to the PR's changes overview (auto-detected route). */
export function navigateToPrChanges(pr: PrId): Promise<NavResult> {
  return navigateActive((tabUrl) => buildPrChangesUrl(pr, prDiffRoute(tabUrl)));
}

/** Pixels to leave above a file's diff so GitHub's sticky header doesn't cover it. */
export const DIFF_HEADER_OFFSET = 100;

/** The scrollTop that puts an element's top just below the sticky header. Pure —
 *  the injected scroller inlines the same formula (it can't import this). */
export function diffScrollTop(elementTop: number, scrollY: number, headerOffset = DIFF_HEADER_OFFSET): number {
  return Math.max(0, Math.round(elementTop + scrollY - headerOffset));
}

/** Typical reading / TTS-speaking rates (words per minute) — pace the guided scroll
 *  so the file scrolls past roughly as fast as the explanation is read / spoken. */
export const TEXT_WPM = 240;
export const VOICE_WPM = 155;

/** Estimate how long `text` takes to read/speak at `wpm`, clamped to a sane range
 *  (a guided scroll should never be instant nor crawl for minutes). Pure. */
export function estimateReadingMs(text: string, wpm: number, minMs = 1500, maxMs = 30000): number {
  const words = (text.trim().match(/\S+/g) ?? []).length;
  const ms = (words / Math.max(1, wpm)) * 60000;
  return Math.round(Math.min(maxMs, Math.max(minMs, ms)));
}

/**
 * Runs IN THE PAGE (serialised by chrome.scripting — must be self-contained, no
 * imports/closures). GitHub's `/files` & `/changes` diff is virtualised and lazily
 * rendered, so the browser's native `#diff-…` hash-scroll is unreliable. This:
 *   1. POLLS for the target file's diff container (by its `diff-<sha256(path)>` id,
 *      with a full-path-text fallback), retrying while GitHub renders it in,
 *   2. EXPANDS a collapsed "Load Diff" placeholder so the code is actually visible
 *      (we're explaining this file), then
 *   3. scrolls it to the top below the sticky header — and, when `durationMs > 0`,
 *      GUIDED-scrolls through the file over that long (paced to the explanation's
 *      read/speak time), cancelling the instant a human scrolls/keys/touches.
 */
export function scrollToDiffInPage(anchorId: string, path: string, headerOffset: number, durationMs: number): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  // Supersede any prior nav's poller / guided scroll so consecutive files don't fight.
  if (w.__driftNav) {
    try {
      clearInterval(w.__driftNav.iv);
      cancelAnimationFrame(w.__driftNav.raf);
      if (w.__driftNav.stop) w.__driftNav.stop();
    } catch (e) {
      /* ignore */
    }
  }
  const state = (w.__driftNav = { iv: 0, raf: 0, stop: null as null | (() => void) });

  const find = (): Element | null => {
    const byId = document.getElementById(anchorId);
    if (byId) return byId;
    // Fallback (if the id scheme ever differs): a header whose FULL path text matches,
    // climbed to its diff container — never a sidebar entry (those aren't in a diff).
    const nodes = document.querySelectorAll('[title],a,h3,h4,[data-path],[data-file-path]');
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as HTMLElement;
      const txt = (n.getAttribute('data-path') || n.getAttribute('data-file-path') || n.getAttribute('title') || n.textContent || '').trim();
      if (txt === path) {
        const container = n.closest('[id^="diff-"]');
        if (container) return container;
      }
    }
    return null;
  };
  // Click a collapsed "Load Diff" placeholder inside the file so the code renders.
  const expand = (container: Element): void => {
    const clickables = container.querySelectorAll('button,[role="button"],summary,a');
    for (let i = 0; i < clickables.length; i++) {
      if (/^\s*load diff\s*$/i.test(clickables[i].textContent || '')) {
        (clickables[i] as HTMLElement).click();
        return;
      }
    }
  };
  const absTop = (el: Element) => el.getBoundingClientRect().top + w.scrollY;

  const begin = (container: Element): void => {
    expand(container);
    if (!durationMs || durationMs < 400) {
      const top = Math.max(0, absTop(container) - headerOffset);
      w.scrollTo({ top, behavior: 'smooth' });
      return;
    }
    // GUIDED scroll: animate from the file's top to its end over durationMs, cancelled
    // the instant the user takes over. Positions recomputed each frame so a late
    // "Load Diff" render (layout shift) doesn't desync the scroll.
    let startT: number | null = null;
    let canceled = false;
    const cancel = () => {
      canceled = true;
      w.removeEventListener('wheel', cancel);
      w.removeEventListener('keydown', cancel);
      w.removeEventListener('touchstart', cancel);
    };
    state.stop = cancel;
    w.addEventListener('wheel', cancel, { passive: true });
    w.addEventListener('keydown', cancel);
    w.addEventListener('touchstart', cancel, { passive: true });
    const tick = (ts: number) => {
      if (canceled || !(container as any).isConnected) {
        cancel();
        return;
      }
      if (startT == null) startT = ts;
      const rect = container.getBoundingClientRect();
      const start = Math.max(0, rect.top + w.scrollY - headerOffset);
      const end = Math.max(start, rect.bottom + w.scrollY - w.innerHeight + headerOffset);
      const p = Math.min(1, (ts - startT) / durationMs);
      w.scrollTo({ top: start + (end - start) * p });
      if (p < 1) state.raf = requestAnimationFrame(tick);
      else cancel();
    };
    state.raf = requestAnimationFrame(tick);
  };

  const found = find();
  if (found) {
    begin(found);
    return;
  }
  let tries = 0;
  state.iv = setInterval(() => {
    const c = find();
    if (c) {
      clearInterval(state.iv);
      state.iv = 0;
      begin(c);
    } else if (++tries > 40) {
      clearInterval(state.iv);
      state.iv = 0;
    }
  }, 250) as unknown as number;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Wait until the tab finishes loading (so we inject into the NEW page, not one
 *  that's about to reload). Resolves immediately for a same-page hash change. */
async function waitForTabComplete(tabId: number, timeoutMs = 4000): Promise<void> {
  if (!chrome.tabs?.get) return;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status === 'complete') return;
    await new Promise((r) => setTimeout(r, 120));
  }
}

/** Inject the poll-find-expand-scroll into the tab. `durationMs > 0` adds the
 *  guided scroll-through. Best-effort (navigation already succeeded). */
async function scrollDiffIntoView(tabId: number, anchorId: string, path: string, durationMs: number): Promise<void> {
  if (!chrome.scripting?.executeScript) return;
  await waitForTabComplete(tabId);
  await chrome.scripting
    .executeScript({ target: { tabId }, func: scrollToDiffInPage, args: [anchorId, path, DIFF_HEADER_OFFSET, durationMs] })
    .catch(() => {});
}

/** Guided scroll through a file already on screen, paced to `durationMs` (the
 *  explanation's read/speak time). Re-expands "Load Diff" if needed. The handover
 *  calls this AFTER generating the explanation so the scroll tracks the delivery. */
export async function guideScrollThroughFile(anchorId: string, path: string, durationMs: number): Promise<void> {
  const tab = await activeTab().catch(() => undefined);
  if (tab?.id == null) return;
  await scrollDiffIntoView(tab.id, anchorId, path, durationMs);
}

/** Navigate the active tab to one changed file's diff AND scroll that file to the
 *  top. Pass a precomputed `anchorId` to avoid re-hashing (the session steps carry
 *  it). */
export async function navigateToPrFile(
  pr: PrId,
  path: string,
  opts: { anchorId?: string } = {},
): Promise<NavResult> {
  const anchorId = opts.anchorId ?? (await diffAnchor(path));
  const tab = await activeTab().catch(() => undefined);
  const url = buildPrFileUrl(pr, prDiffRoute(tab?.url ?? undefined), anchorId);
  if (tab?.id == null) return { ok: false, url, reason: 'no active browser tab to navigate' };
  try {
    await chrome.tabs.update(tab.id, { url });
  } catch (e) {
    return { ok: false, url, reason: e instanceof Error ? e.message : String(e) };
  }
  // GitHub's native hash-scroll is unreliable on its virtualised diff — explicitly
  // poll for + scroll to the file (top, below the sticky header) and expand "Load
  // Diff". durationMs 0 = land at the top now; the guided scroll-through happens
  // after the explanation is generated (guideScrollThroughFile).
  await scrollDiffIntoView(tab.id, anchorId, path, 0);
  return { ok: true, url };
}

/** Where the active tab currently is, relative to `pr`. Lets the handover note
 *  "you're already on the changes page" / which file the reviewer is viewing. */
export interface ActiveTabLocation extends PrLocation {
  /** The active tab is on THIS PR (host + owner/repo + number all match). */
  onThisPr: boolean;
  /** On THIS PR's diff page (files or changes). */
  onChangesPage: boolean;
  /** The raw active-tab URL (diagnostics). */
  tabUrl: string | null;
}

/** Read the active tab and classify it against `pr`. */
export async function locateActiveTab(pr: PrId): Promise<ActiveTabLocation> {
  const tab = await activeTab().catch(() => undefined);
  const tabUrl = tab?.url ?? null;
  const loc = parsePrLocation(tabUrl);
  const onThisPr =
    !!loc.id &&
    loc.id.host === pr.host &&
    loc.id.owner === pr.owner &&
    loc.id.repo === pr.repo &&
    loc.id.number === pr.number;
  const onChangesPage = onThisPr && (loc.section === 'files' || loc.section === 'changes');
  return { ...loc, onThisPr, onChangesPage, tabUrl };
}
