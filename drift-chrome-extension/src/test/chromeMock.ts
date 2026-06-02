// In-memory chrome.* mock for testing the state + UI layers without a browser.
// Covers storage.local (+ onChanged), runtime/tabs messaging, and no-op
// tabs/webNavigation/downloads event hubs.

import type { PrContext } from '../core/types';

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Listener = (changes: Changes, area: string) => void;

export interface ChromeMock {
  store: Map<string, unknown>;
  /** Responder for chrome.runtime.sendMessage (FETCH_ARTIFACT / OPEN_SIDE_PANEL). */
  setResponder: (fn: (msg: unknown) => unknown | Promise<unknown>) => void;
  /** Context returned to GET_CONTEXT queries (the active-tab content script). */
  setContext: (ctx: PrContext | null) => void;
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
      query: async () => [{ id: 1, url: 'https://github.com/o/r/pull/70' }],
      sendMessage: (_tabId: number, msg: { type?: string }, cb?: (res: unknown) => void) => {
        if (msg?.type === 'GET_CONTEXT') cb?.({ ok: true, context });
        else cb?.({ ok: true });
      },
      onActivated: noopHub(),
      onUpdated: noopHub(),
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
  };
}
