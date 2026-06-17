// In-memory chrome.* mock for testing the state + UI layers without a browser.
// Covers storage.local (+ onChanged), runtime/tabs messaging, and no-op
// tabs/webNavigation/downloads event hubs.

import type { PrContext } from '../core/types';

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Listener = (changes: Changes, area: string) => void;

/** A recorded chrome.tabs.update call — lets navigation tests assert the URL. */
export interface TabUpdateRecord {
  tabId?: number;
  props: { url?: string };
}

/** A recorded chrome.scripting.executeScript call (the post-nav scroll inject). */
export interface ExecuteScriptRecord {
  tabId?: number;
  func?: (...a: unknown[]) => unknown;
  args?: unknown[];
}

export interface ChromeMock {
  store: Map<string, unknown>;
  /** Responder for chrome.runtime.sendMessage (FETCH_ARTIFACT / OPEN_SIDE_PANEL). */
  setResponder: (fn: (msg: unknown) => unknown | Promise<unknown>) => void;
  /** Context returned to GET_CONTEXT queries (the active-tab content script). */
  setContext: (ctx: PrContext | null) => void;
  /** Override the active tab returned by chrome.tabs.query (id/url). */
  setActiveTab: (tab: { id?: number; url?: string } | undefined) => void;
  /** The most recent chrome.tabs.update call (navigation), or null. */
  lastTabUpdate: () => TabUpdateRecord | null;
  /** The most recent chrome.scripting.executeScript call, or null. */
  lastExecuteScript: () => ExecuteScriptRecord | null;
}

const noopHub = () => ({ addListener: () => {}, removeListener: () => {} });

export function installChromeMock(): ChromeMock {
  const store = new Map<string, unknown>();
  const listeners: Listener[] = [];
  const emit = (changes: Changes) => listeners.forEach((l) => l(changes, 'local'));

  let responder: (msg: unknown) => unknown | Promise<unknown> = () => ({
    ok: false,
    error: 'no responder installed',
  });
  let context: PrContext | null = null;
  let activeTab: { id?: number; url?: string } | undefined = {
    id: 1,
    url: 'https://github.com/o/r/pull/70',
  };
  let lastTabUpdate: TabUpdateRecord | null = null;
  let lastExecuteScript: ExecuteScriptRecord | null = null;

  const local = {
    async get(keys?: string | string[] | null) {
      if (keys == null) return Object.fromEntries(store);
      const arr = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of arr) if (store.has(k)) out[k] = store.get(k);
      return out;
    },
    async set(obj: Record<string, unknown>) {
      const changes: Changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: store.get(k), newValue: v };
        store.set(k, v);
      }
      emit(changes);
    },
    async remove(keys: string | string[]) {
      const arr = Array.isArray(keys) ? keys : [keys];
      const changes: Changes = {};
      for (const k of arr) {
        if (store.has(k)) {
          changes[k] = { oldValue: store.get(k) };
          store.delete(k);
        }
      }
      emit(changes);
    },
    async clear() {
      store.clear();
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local,
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
    },
    runtime: {
      lastError: undefined as { message?: string } | undefined,
      getURL: (path: string) => `chrome-extension://test/${path.replace(/^\//, '')}`,
      sendMessage: (msg: unknown, cb?: (res: unknown) => void) => {
        Promise.resolve(responder(msg)).then(
          (res) => cb?.(res),
          (err) => cb?.({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
      },
      onMessage: noopHub(),
    },
    tabs: {
      query: async () => (activeTab ? [activeTab] : []),
      // chrome.tabs.update navigates a tab (MV3 returns a Promise<Tab>; the
      // callback form is supported too). We record it so navigation tests can
      // assert the URL, and reflect the new URL back into the active tab.
      update: (tabId: number, props: { url?: string }, cb?: (tab: unknown) => void) => {
        lastTabUpdate = { tabId, props };
        if (props?.url) activeTab = { ...(activeTab ?? {}), id: tabId, url: props.url };
        const tab = { ...(activeTab ?? {}), id: tabId };
        cb?.(tab);
        return Promise.resolve(tab);
      },
      // Tabs are reported ready immediately so waitForTabComplete resolves fast.
      get: (tabId: number, cb?: (tab: unknown) => void) => {
        const tab = { ...(activeTab ?? {}), id: tabId, status: 'complete' };
        cb?.(tab);
        return Promise.resolve(tab);
      },
      sendMessage: (_tabId: number, msg: { type?: string }, cb?: (res: unknown) => void) => {
        if (msg?.type === 'GET_CONTEXT') cb?.({ ok: true, context });
        else cb?.({ ok: true });
      },
      onActivated: noopHub(),
      onUpdated: noopHub(),
    },
    scripting: {
      // Record the post-navigation scroll injection so tests can assert it ran with
      // the right (anchor, path). We don't execute `func` (no real DOM here).
      executeScript: (injection: { target?: { tabId?: number }; func?: (...a: unknown[]) => unknown; args?: unknown[] }) => {
        lastExecuteScript = { tabId: injection?.target?.tabId, func: injection?.func, args: injection?.args };
        return Promise.resolve([{ result: undefined }]);
      },
    },
    webNavigation: {
      onHistoryStateUpdated: noopHub(),
      onCompleted: noopHub(),
    },
    downloads: {
      download: (_o: unknown, cb?: (id: number) => void) => cb?.(1),
      search: (_q: unknown, cb?: (items: unknown[]) => void) => cb?.([]),
      show: () => {},
      open: () => {},
      onChanged: noopHub(),
    },
  };

  return {
    store,
    setResponder: (fn) => (responder = fn),
    setContext: (c) => (context = c),
    setActiveTab: (tab) => (activeTab = tab),
    lastTabUpdate: () => lastTabUpdate,
    lastExecuteScript: () => lastExecuteScript,
  };
}
