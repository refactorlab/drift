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
import type { ScrollStep } from '../agents/scrollPlan';

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


/**
 * Runs IN THE PAGE (serialised by chrome.scripting — must be self-contained, no
 * imports/closures). GitHub's `/files` & `/changes` diff is virtualised and lazily
 * rendered, so the browser's native `#diff-…` hash-scroll is unreliable. This:
 *   1. POLLS for the target file's diff container (by its `diff-<sha256(path)>` id,
 *      with a full-path-text fallback), retrying while GitHub renders it in,
 *   2. EXPANDS a collapsed "Load Diff" placeholder so the code is actually visible,
 *   3. scrolls it to the TOP below the sticky header.
 */
export function scrollToDiffInPage(anchorId: string, path: string, headerOffset: number): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
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
    const nodes = document.querySelectorAll('[title],a,h3,h4,[data-path],[data-file-path]');
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as HTMLElement;
      const txt = (n.getAttribute('data-path') || n.getAttribute('data-file-path') || n.getAttribute('title') || n.textContent || '').trim();
      if (txt === path) {
        const c = n.closest('[id^="diff-"]');
        if (c) return c;
      }
    }
    return null;
  };
  const expand = (c: Element): void => {
    const cl = c.querySelectorAll('button,[role="button"],summary,a');
    for (let i = 0; i < cl.length; i++) {
      if (/^\s*load diff\s*$/i.test(cl[i].textContent || '')) {
        (cl[i] as HTMLElement).click();
        return;
      }
    }
  };
  const land = (c: Element) => {
    expand(c);
    // scrollIntoView is LAYOUT-ROBUST: a computed scrollTo can land on the
    // ADJACENT file after GitHub's virtualised diff lazy-renders/shifts (the
    // "showed voicePrompt.test.ts instead of voicePrompt.ts" bug). scroll-margin-top
    // leaves room for the sticky header.
    try {
      (c as HTMLElement).style.scrollMarginTop = headerOffset + 'px';
    } catch (e) {
      /* ignore */
    }
    c.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  // VIRTUALISATION FIX: an off-screen file's `diff-…` container isn't in the DOM
  // at all, so neither the URL hash nor scrollIntoView can reach it — which is why
  // "next" to a file far down a 77-file PR left the page on the PREVIOUS file. The
  // file-TREE row (always present for every changed file, regardless of scroll) links
  // to the same anchor; clicking it is exactly how a human jumps there — GitHub
  // renders the file in and scrolls to it. We click it, then the poll lands precisely
  // once the container mounts.
  const clickFileTree = (): boolean => {
    const byHref =
      (document.querySelector('a[href$="#' + anchorId + '"]') as HTMLElement | null) ||
      (document.querySelector('a[href*="#' + anchorId + '"]') as HTMLElement | null);
    if (byHref) {
      byHref.click();
      return true;
    }
    const base = path.split('/').pop() || path;
    const rows = Array.from(
      document.querySelectorAll('[role="treeitem"],nav a[title],a[title],button[title],[data-tree-entry-type] a,.ActionList-item'),
    ) as HTMLElement[];
    const textOf = (el: HTMLElement) => (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '').trim();
    const hit =
      rows.find((el) => {
        const t = textOf(el);
        return t === path || (t.indexOf('/') >= 0 && (t.endsWith('/' + path) || path.endsWith('/' + t)));
      }) || rows.find((el) => textOf(el) === base);
    if (hit) {
      hit.click();
      return true;
    }
    return false;
  };
  // Verbose-level breadcrumb (filtered out of the GitHub tab's console by default) so a
  // future "it didn't navigate" can be traced to the exact branch that ran.
  const log = (m: string) => {
    try {
      console.debug('[drift:nav] ' + m + ' — ' + path);
    } catch (e) {
      /* ignore */
    }
  };
  const c0 = find();
  if (c0) {
    log('container in DOM → scrollIntoView');
    land(c0);
    return;
  }
  // Not in the DOM (virtualised). Prefer GitHub's own file-tree row (smooth, no
  // reload). If there's NO tree row to click (tree collapsed/absent), a same-document
  // hash can't render a far-down file — the only reliable way is to re-trigger
  // GitHub's on-LOAD hash handler, i.e. reload the (already #anchor'd) URL.
  if (!clickFileTree()) {
    log('virtualised + no file-tree row → reloading to deep-link');
    try {
      location.reload();
    } catch (e) {
      /* ignore */
    }
    return;
  }
  log('virtualised → clicked file-tree row, polling for render');
  let tries = 0;
  state.iv = setInterval(() => {
    const c = find();
    if (c) {
      clearInterval(state.iv);
      state.iv = 0;
      land(c);
    } else if (++tries > 40) {
      clearInterval(state.iv);
      state.iv = 0;
      try {
        location.reload(); // tree click never rendered it → deep-link via a fresh load
      } catch (e) {
        /* ignore */
      }
    } else if (tries % 6 === 0) {
      clickFileTree(); // retry while the SPA route/tree settles
    }
  }, 250) as unknown as number;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Runs IN THE PAGE — the scroll-plan EXECUTOR. Walks an ordered list of line ranges,
 * DWELLING on each for its own duration (paced to the narration), with smooth eased
 * transitions and a hard speed cap so it never races. A tall range scrolls THROUGH
 * itself during its dwell; a short one holds. Cancels the instant the user
 * scrolls/keys/touches, so it follows along but never fights them. Self-contained.
 */
export function runScrollPlanInPage(
  anchorId: string,
  path: string,
  headerOffset: number,
  plan: ScrollStep[],
  startDelayMs: number,
): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
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

  const findContainer = (): Element | null => {
    const byId = document.getElementById(anchorId);
    if (byId) return byId;
    const nodes = document.querySelectorAll('[title],a,h3,h4,[data-path],[data-file-path]');
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as HTMLElement;
      const txt = (n.getAttribute('data-path') || n.getAttribute('data-file-path') || n.getAttribute('title') || n.textContent || '').trim();
      if (txt === path) {
        const c = n.closest('[id^="diff-"]');
        if (c) return c;
      }
    }
    return null;
  };
  // Inject the highlight stylesheet once — a soft amber wash + left accent bar that
  // reads on GitHub light AND dark, with a brief arrival pulse (modern, unobtrusive).
  const ensureStyle = () => {
    if (document.getElementById('drift-present-style')) return;
    const st = document.createElement('style');
    st.id = 'drift-present-style';
    st.textContent =
      '.drift-present-hl{background-color:rgba(255,193,7,.16)!important;box-shadow:inset 3px 0 0 0 #f5a623!important;transition:background-color .35s ease,box-shadow .35s ease}' +
      '.drift-present-pulse{animation:driftPresentPulse 1.1s ease-out}' +
      '.drift-present-name{background-color:rgba(245,166,35,.5);box-shadow:0 0 0 1px rgba(245,166,35,.7);border-radius:3px;padding:0 1px}' +
      '@keyframes driftPresentPulse{0%{background-color:rgba(245,166,35,.45)}100%{background-color:rgba(255,193,7,.16)}}';
    (document.head || document.documentElement).appendChild(st);
  };

  const run = (container: Element) => {
    const cl = container.querySelectorAll('button,[role="button"],summary,a');
    for (let i = 0; i < cl.length; i++) {
      if (/^\s*load diff\s*$/i.test(cl[i].textContent || '')) {
        (cl[i] as HTMLElement).click();
        break;
      }
    }
    ensureStyle();

    // Highlight the diff rows for a NEW-side line range; clear the previous range.
    let highlighted: HTMLElement[] = [];
    let nameMarks: HTMLElement[] = [];
    const clearHL = () => {
      for (const el of highlighted) el.classList.remove('drift-present-hl', 'drift-present-pulse');
      highlighted = [];
      // Un-wrap any sub-line name spans (restore the original text node).
      for (const span of nameMarks) {
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(span.textContent || ''), span);
          (parent as Element).normalize?.();
        }
      }
      nameMarks = [];
    };
    // SUB-LINE: emphasise the symbol NAME within a row by wrapping its first
    // word-bounded occurrence. Best-effort + non-fatal (the row highlight is the
    // reliable layer); restored on the next clear.
    const wrapName = (row: HTMLElement, name: string) => {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^\\w$])(' + esc + ')(?![\\w$])');
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || '';
        const m = text.match(re);
        if (!m) continue;
        const idx = (m.index || 0) + m[1].length;
        const parent = node.parentNode;
        if (!parent) return;
        const span = document.createElement('span');
        span.className = 'drift-present-name';
        span.textContent = name;
        parent.insertBefore(document.createTextNode(text.slice(0, idx)), node);
        parent.insertBefore(span, node);
        parent.insertBefore(document.createTextNode(text.slice(idx + name.length)), node);
        parent.removeChild(node);
        nameMarks.push(span);
        return; // first occurrence only
      }
    };
    const highlight = (a: number, b: number, name?: string) => {
      clearHL();
      for (let n = a; n <= b && n < a + 60; n++) {
        const cell = container.querySelector('[data-line-number="' + n + '"]');
        const row = (cell && (cell.closest('[role="row"],tr') || cell.parentElement)) as HTMLElement | null;
        if (row && highlighted.indexOf(row) < 0) {
          row.classList.add('drift-present-hl', 'drift-present-pulse');
          highlighted.push(row);
        }
      }
      if (name && highlighted.length) {
        try {
          wrapName(highlighted[0], name);
        } catch (e) {
          /* best-effort sub-line emphasis */
        }
      }
    };

    // The NEW-side line numbers currently rendered in this file's diff (GitHub collapses
    // far context, so not every line is present). Used to land on the closest line.
    const renderedLineNumbers = (): number[] => {
      const out: number[] = [];
      const cells = container.querySelectorAll('[data-line-number]');
      for (let i = 0; i < cells.length; i++) {
        const v = Number((cells[i] as HTMLElement).getAttribute('data-line-number'));
        if (!Number.isNaN(v)) out.push(v);
      }
      return out;
    };
    // EXPAND collapsed context rows (GitHub's "Expand"/unfold controls) so a target line
    // that's hidden between hunks can be revealed. Bounded — we only reveal a few, and only
    // when the line we want isn't already on screen. Skips "Load diff" (handled separately).
    const expandContext = (max: number): number => {
      const btns = container.querySelectorAll('button,[role="button"],a');
      let clicked = 0;
      for (let i = 0; i < btns.length && clicked < max; i++) {
        const el = btns[i] as HTMLElement;
        const t = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').toLowerCase();
        if (/expand|unfold/.test(t) && !/load diff/.test(t)) {
          el.click();
          clicked++;
        }
      }
      return clicked;
    };
    // Resolve a NEW-side line number to a real cell: exact → expand-then-exact → the
    // CLOSEST rendered line (ties → lower). So we always land on (or right beside) the
    // changed line, never silently jump to the file top.
    const resolveLineCell = (line: number): HTMLElement | null => {
      let cell = container.querySelector('[data-line-number="' + line + '"]') as HTMLElement | null;
      if (cell) return cell;
      if (expandContext(4)) {
        cell = container.querySelector('[data-line-number="' + line + '"]') as HTMLElement | null;
        if (cell) return cell;
      }
      let best: number | null = null;
      let bestDist = Infinity;
      for (const n of renderedLineNumbers()) {
        const d = Math.abs(n - line);
        if (d < bestDist || (d === bestDist && best !== null && n < best)) {
          best = n;
          bestDist = d;
        }
      }
      return best !== null ? (container.querySelector('[data-line-number="' + best + '"]') as HTMLElement | null) : null;
    };

    let canceled = false;
    let timer = 0;
    const cancel = (clear: boolean) => {
      canceled = true;
      clearTimeout(timer);
      try {
        cancelAnimationFrame(state.raf);
      } catch (e) {
        /* ignore */
      }
      w.removeEventListener('wheel', onUser);
      w.removeEventListener('keydown', onUser);
      w.removeEventListener('touchstart', onUser);
      if (clear) clearHL();
    };
    const onUser = () => {
      // A human grabbed the scroll/keys — tell the panel so it can PAUSE the walkthrough
      // at the current spot (and offer "resume from here"), then stop following + clear.
      // Only the USER path messages; a programmatic supersede (state.stop, below) doesn't.
      try {
        const r = chrome.runtime?.sendMessage?.({ type: 'drift:present-interrupted', anchorId, path });
        if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {});
      } catch (e) {
        /* messaging unavailable in this context — the page still stops following */
      }
      cancel(true);
    };
    state.stop = () => cancel(true);
    w.addEventListener('wheel', onUser, { passive: true });
    w.addEventListener('keydown', onUser);
    w.addEventListener('touchstart', onUser, { passive: true });

    // The document Y that puts an element's top just below the sticky header.
    const docY = (el: HTMLElement): number => Math.max(0, Math.round((w.scrollY || 0) + el.getBoundingClientRect().top - headerOffset));
    // OVERVIEW SWEEP: from the file top, slow-scroll the window DOWN to the first change
    // over `dwell` (reading-speed paced) — eased + cancelable. Falls back to a no-op when
    // there's nothing to traverse or no rAF (the top scroll already landed the file).
    const sweepScroll = (endCell: HTMLElement | null, dwell: number) => {
      const startY = w.scrollY || 0;
      let endY: number;
      if (endCell) endY = docY(endCell);
      else {
        const rect = (container as HTMLElement).getBoundingClientRect();
        endY = Math.round(startY + rect.bottom - (w.innerHeight || 800) + headerOffset);
      }
      endY = Math.max(startY, endY);
      if (endY <= startY + 4 || typeof requestAnimationFrame !== 'function') return;
      const clock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
      const t0 = clock();
      const ease = (p: number) => 1 - Math.pow(1 - p, 2); // easeOutQuad — gentle, decelerating
      const frame = () => {
        if (canceled) return;
        const p = Math.min(1, (clock() - t0) / dwell);
        try {
          w.scrollTo(0, Math.round(startY + (endY - startY) * ease(p)));
        } catch (e) {
          /* ignore */
        }
        if (p < 1) state.raf = requestAnimationFrame(frame) as unknown as number;
      };
      state.raf = requestAnimationFrame(frame) as unknown as number;
    };

    const step = (i: number) => {
      if (canceled || i >= plan.length || !(container as any).isConnected) {
        return; // natural end keeps the last highlight until the next nav supersedes us
      }
      const s = plan[i];
      // OVERVIEW beat: start at the TOP of the file and slow-sweep down to the first change
      // while Level 1 + Level 2 are read — no row highlight, just the gentle scroll.
      if (s.sweep) {
        clearHL();
        const dwell = Math.max(900, s.dwellMs);
        try {
          (container as HTMLElement).style.scrollMarginTop = headerOffset + 'px';
        } catch (e) {
          /* ignore */
        }
        (container as HTMLElement).scrollIntoView({ block: 'start', behavior: 'auto' });
        sweepScroll(resolveLineCell(s.endLine), dwell);
        timer = setTimeout(() => step(i + 1), dwell) as unknown as number;
        return;
      }
      // Resolve the changed line FIRST (this may expand collapsed context), so the
      // highlight that follows can find the now-revealed rows.
      const cell = resolveLineCell(s.startLine);
      highlight(s.startLine, s.endLine, s.name);
      // If the changed range itself wasn't rendered, highlight the resolved nearest row so
      // there's always a visible marker at the spot we scrolled to.
      if (!highlighted.length && cell) {
        const row = (cell.closest('[role="row"],tr') || cell.parentElement) as HTMLElement | null;
        if (row) {
          row.classList.add('drift-present-hl', 'drift-present-pulse');
          highlighted.push(row);
        }
      }
      // Scroll the resolved cell (scoped to THIS file's container → never a neighbouring
      // file) into view. scrollIntoView is layout-robust on GitHub's virtualised diff.
      const target = (cell ?? (container as HTMLElement)) as HTMLElement;
      try {
        target.style.scrollMarginTop = headerOffset + 'px';
      } catch (e) {
        /* ignore */
      }
      target.scrollIntoView({ block: cell ? 'center' : 'start', behavior: 'smooth' });
      timer = setTimeout(() => step(i + 1), Math.max(900, s.dwellMs)) as unknown as number;
    };
    // Voice gets a small lead delay so the scroll doesn't outrun the first audio.
    if (startDelayMs > 0) timer = setTimeout(() => step(0), startDelayMs) as unknown as number;
    else step(0);
  };

  // Same virtualisation fix as scrollToDiffInPage: if the file isn't rendered yet,
  // click its always-present file-tree row so GitHub renders + scrolls it in, then
  // the poll runs the dwell-plan once the container mounts. (Covers the beat-button
  // replay path, which can target a file the user has since scrolled away from.)
  const clickFileTree = (): boolean => {
    const byHref =
      (document.querySelector('a[href$="#' + anchorId + '"]') as HTMLElement | null) ||
      (document.querySelector('a[href*="#' + anchorId + '"]') as HTMLElement | null);
    if (byHref) {
      byHref.click();
      return true;
    }
    const base = path.split('/').pop() || path;
    const rows = Array.from(
      document.querySelectorAll('[role="treeitem"],nav a[title],a[title],button[title],[data-tree-entry-type] a,.ActionList-item'),
    ) as HTMLElement[];
    const textOf = (el: HTMLElement) => (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '').trim();
    const hit =
      rows.find((el) => {
        const t = textOf(el);
        return t === path || (t.indexOf('/') >= 0 && (t.endsWith('/' + path) || path.endsWith('/' + t)));
      }) || rows.find((el) => textOf(el) === base);
    if (hit) {
      hit.click();
      return true;
    }
    return false;
  };
  const c0 = findContainer();
  if (c0) {
    run(c0);
    return;
  }
  clickFileTree(); // not rendered (virtualised) → drive GitHub's own file-tree navigation
  let tries = 0;
  state.iv = setInterval(() => {
    const c = findContainer();
    if (c) {
      clearInterval(state.iv);
      state.iv = 0;
      run(c);
    } else if (++tries > 40) {
      clearInterval(state.iv);
      state.iv = 0;
    } else if (tries % 6 === 0) {
      clickFileTree(); // retry while the SPA route/tree settles
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

/** Inject the poll-find-expand-scroll-to-top into the tab. Best-effort. */
async function scrollDiffIntoView(tabId: number, anchorId: string, path: string): Promise<void> {
  if (!chrome.scripting?.executeScript) return;
  await waitForTabComplete(tabId);
  await chrome.scripting
    .executeScript({ target: { tabId }, func: scrollToDiffInPage, args: [anchorId, path, DIFF_HEADER_OFFSET] })
    .catch(() => {});
}

/** Execute a scroll plan over a file already on screen — dwell on each changed
 *  region paced to the narration. `mode` adds a small lead delay for voice so the
 *  scroll doesn't outrun the first spoken audio. Best-effort, fire-and-forget. */
export async function runScrollPlanThroughFile(
  anchorId: string,
  path: string,
  plan: ScrollStep[],
  mode: 'text' | 'voice' = 'text',
): Promise<void> {
  if (!plan.length) return;
  const tab = await activeTab().catch(() => undefined);
  if (tab?.id == null || !chrome.scripting?.executeScript) return;
  await waitForTabComplete(tab.id);
  await chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: runScrollPlanInPage,
      args: [anchorId, path, DIFF_HEADER_OFFSET, plan, mode === 'voice' ? 700 : 0],
    })
    .catch(() => {});
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
  // poll for + scroll the file to the top (below the sticky header) and expand "Load
  // Diff". The dwell-scroll through the changed regions happens after the explanation
  // is generated (runScrollPlanThroughFile).
  await scrollDiffIntoView(tab.id, anchorId, path);
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
