// Resolve a PR's base/head refs WITHOUT the GitHub API. Modern GitHub PR pages
// are React-rendered: the authoritative data (baseRefName, headRefName, …) is
// embedded as JSON in the LIVE DOM but is often ABSENT from a cold HTML fetch
// (it's loaded deferred). So the reliable source is the live tab's DOM, read by
// the content script. Resolution order:
//   1. live DOM via the content script (GET_PR_REFS) — most reliable
//   2. fetch the PR HTML + parse (fallback when the content script isn't there)
// Each parse tries the embedded JSON (real JSON.parse + find the PR node) first,
// then the visible base-ref/head-ref DOM elements, then loose regexes.

import { activeTab, sendToTab } from './messaging';

export type PrRefs = {
  baseOwner: string;
  baseRepo: string;
  baseRef: string;
  baseSha?: string;
  headOwner: string;
  headRepo: string;
  headRef: string;
  headSha?: string;
  title?: string;
};

export type PrId = { owner: string; repo: string; number: number };

/** Parse `owner/repo` + PR number straight from a GitHub PR URL (no DOM, no API). */
export function parsePrUrl(url: string): PrId | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\b/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

function first(html: string, re: RegExp): string | undefined {
  return html.match(re)?.[1];
}

// ── Embedded-JSON strategy (the authoritative source) ──────────────────────

type AnyObj = Record<string, unknown>;
const isObj = (v: unknown): v is AnyObj => typeof v === 'object' && v !== null;

/** Recursively find the object that carries BOTH baseRefName + headRefName —
 *  i.e. the pull-request node — so we read every field off the SAME object. */
function findPrNode(node: unknown, depth = 0): AnyObj | null {
  if (!isObj(node) || depth > 14) return null;
  if (typeof node.baseRefName === 'string' && typeof node.headRefName === 'string') return node;
  for (const v of Object.values(node)) {
    const found = findPrNode(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/** Build PrRefs from a found PR node. */
function refsFromNode(node: AnyObj, owner: string, repo: string): PrRefs {
  const headRepository = isObj(node.headRepository) ? node.headRepository : undefined;
  const headRepoOwner = headRepository && isObj(headRepository.owner) ? headRepository.owner : undefined;
  const headRepositoryOwner = isObj(node.headRepositoryOwner) ? node.headRepositoryOwner : undefined;
  return {
    baseOwner: owner,
    baseRepo: repo,
    baseRef: str(node.baseRefName) ?? 'main',
    baseSha: /^[0-9a-f]{40}$/i.test(str(node.baseRefOid) ?? '') ? str(node.baseRefOid) : undefined,
    headOwner: str(headRepoOwner?.login) ?? str(headRepositoryOwner?.login) ?? owner,
    headRepo: str(headRepository?.name) ?? repo,
    headRef: str(node.headRefName) ?? '',
    headSha: /^[0-9a-f]{40}$/i.test(str(node.headRefOid) ?? '') ? str(node.headRefOid) : undefined,
    title: str(node.title),
  };
}

/** Parse each embedded-JSON blob and pull refs off the PR node. */
function refsFromJsonTexts(texts: string[], owner: string, repo: string): PrRefs | null {
  for (const t of texts) {
    if (!t || (!t.includes('headRefName') && !t.includes('baseRefName'))) continue;
    let data: unknown;
    try {
      data = JSON.parse(t);
    } catch {
      continue;
    }
    const node = findPrNode(data);
    if (node) return refsFromNode(node, owner, repo);
  }
  return null;
}

/** Pull `<script type="application/json">…</script>` blob contents from HTML. */
function embeddedJsonTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// ── DOM-element strategy (visible base-ref/head-ref) ───────────────────────

/** Title looks like `owner/repo:branch`, `owner:branch`, or just `branch`. */
function splitRefTitle(title: string): { owner?: string; repo?: string; ref: string } | null {
  const m = title.trim().match(/^(?:([^:/\s]+)(?:\/([^:\s]+))?:)?(.+)$/);
  return m ? { owner: m[1], repo: m[2], ref: m[3].trim() } : null;
}

/** The PR header's stable English summary: "…merge N commits into BASE from
 *  HEAD". Branch names can't contain spaces, so `\S+` is safe. This survives
 *  class/markup churn that breaks `.base-ref`/`.head-ref` selectors. */
export function refsFromHeaderText(doc: Document): { base?: string; head?: string } | null {
  const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ');
  const m =
    text.match(/merge\s+\d+\s+commits?\s+into\s+(\S+)\s+from\s+(\S+)/i) ??
    text.match(/\binto\s+(\S+)\s+from\s+(\S+)/i);
  return m ? { base: m[1], head: m[2] } : null;
}

function refsFromDom(doc: Document, owner: string, repo: string): PrRefs | null {
  const readTitle = (sel: string) => {
    const el = doc.querySelector(sel);
    return el ? splitRefTitle(el.getAttribute('title') || el.textContent || '') : null;
  };
  // 1. The branch-ref chips (title="owner/repo:branch"), when present.
  const baseT = readTitle('.base-ref') ?? readTitle('[class*="base-ref"]');
  const headT = readTitle('.head-ref') ?? readTitle('[class*="head-ref"]');
  // 2. The stable header text — robust to markup changes.
  const txt = refsFromHeaderText(doc);

  const head = headT ?? (txt?.head ? splitRefTitle(txt.head) : null);
  const base = baseT ?? (txt?.base ? splitRefTitle(txt.base) : null);
  if (!head?.ref) return null;

  return {
    baseOwner: owner,
    baseRepo: repo,
    baseRef: base?.ref || 'main',
    headOwner: head.owner ?? owner,
    headRepo: head.repo ?? repo,
    headRef: head.ref,
    title: str(doc.querySelector('.js-issue-title')?.textContent?.trim()),
  };
}

// ── Public parse entry points ──────────────────────────────────────────────

/**
 * Extract refs from a PR page's HTML string. Embedded JSON first (authoritative),
 * then loose regexes as a last resort. (DOM-element parsing needs a real
 * Document; see readPrRefsFromDocument.)
 */
export function parsePrRefs(html: string, owner: string, repo: string): PrRefs {
  const fromJson = refsFromJsonTexts(embeddedJsonTexts(html), owner, repo)
    // Some embeds aren't wrapped in a script tag we matched — try the whole blob.
    ?? refsFromJsonTexts([html], owner, repo);
  if (fromJson && refsAreUsable(fromJson)) return fromJson;

  // Loose-regex fallback (older markup / partial HTML).
  const baseRef = first(html, /"baseRefName":\s*"([^"]+)"/) ?? fromJson?.baseRef ?? 'main';
  const headRef = first(html, /"headRefName":\s*"([^"]+)"/) ?? fromJson?.headRef ?? '';
  const baseSha = first(html, /"baseRefOid":\s*"([0-9a-f]{40})"/i);
  const headSha = first(html, /"headRefOid":\s*"([0-9a-f]{40})"/i);
  const headRepoBlock = first(html, /"headRepository":\s*(\{[\s\S]*?\}\s*\})/);
  let headOwner = fromJson?.headOwner ?? owner;
  let headRepo = fromJson?.headRepo ?? repo;
  if (headRepoBlock) {
    headRepo = first(headRepoBlock, /"name":\s*"([^"]+)"/) ?? headRepo;
    headOwner = first(headRepoBlock, /"login":\s*"([^"]+)"/) ?? headOwner;
  }
  const bdi = first(html, /class="js-issue-title[^"]*"[^>]*>\s*([^<]+?)\s*</);
  const titleTag = first(html, /<title>\s*([^<·|]+?)\s*(?:·|\||<)/);
  const title = (fromJson?.title ?? (bdi ?? titleTag)?.trim()) || undefined;

  return { baseOwner: owner, baseRepo: repo, baseRef, baseSha, headOwner, headRepo, headRef, headSha, title };
}

/** Read refs from a LIVE Document (the content script's authoritative path). */
export function readPrRefsFromDocument(doc: Document): PrRefs | null {
  const id = parsePrUrl(doc.location?.href ?? '');
  if (!id) return null;
  const scripts = Array.from(doc.querySelectorAll('script[type="application/json"]')).map(
    (s) => s.textContent ?? '',
  );
  const fromJson = refsFromJsonTexts(scripts, id.owner, id.repo);
  if (fromJson && refsAreUsable(fromJson)) return fromJson;
  const fromDom = refsFromDom(doc, id.owner, id.repo);
  if (fromDom && refsAreUsable(fromDom)) return fromDom;
  return fromJson ?? fromDom;
}

// ── Usability + download helpers ────────────────────────────────────────────

/** True when we have enough to download both trees (a head ref or head sha). */
export function refsAreUsable(r: PrRefs | null): boolean {
  return !!r && !!(r.headSha || r.headRef) && !!(r.baseSha || r.baseRef);
}

/** Best download ref for a side: prefer the immutable SHA, else the branch. */
export function headDownloadRef(r: PrRefs): string {
  return r.headSha || r.headRef;
}
export function baseDownloadRef(r: PrRefs): string {
  return r.baseSha || r.baseRef;
}

// ── Resolution (inject fresh reader → content script → fetch) ───────────────

/** The raw shape the injected page-reader returns (all JSON-serialisable). */
export type RawPageRefs = {
  base: string | null;
  head: string | null;
  baseSha: string | null;
  headSha: string | null;
  headRepoName: string | null;
  headRepoOwner: string | null;
  title: string | null;
};

/**
 * Runs IN THE PAGE (serialised + injected via chrome.scripting). Self-contained
 * — no imports/closures. Reads refs from the embedded react-app JSON (deep
 * search for the PR node) or the stable header text. Immune to stale content
 * scripts because it's fresh code injected into the live DOM each run.
 */
function readRefsInPage(): RawPageRefs {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  function deep(root: any): any {
    const stack = [root];
    let hops = 0;
    while (stack.length && hops++ < 500000) {
      const n = stack.pop();
      if (n && typeof n === 'object') {
        if (typeof n.baseRefName === 'string' && typeof n.headRefName === 'string') return n;
        for (const k in n) {
          try {
            stack.push(n[k]);
          } catch {
            /* getter threw — skip */
          }
        }
      }
    }
    return null;
  }
  let node: any = null;
  const scripts = document.querySelectorAll('script[type="application/json"]');
  for (let i = 0; i < scripts.length && !node; i++) {
    const tc = scripts[i].textContent;
    if (!tc || (tc.indexOf('headRefName') < 0 && tc.indexOf('baseRefName') < 0)) continue;
    try {
      node = deep(JSON.parse(tc));
    } catch {
      /* not JSON */
    }
  }
  const bodyText = ((document.body && document.body.textContent) || '').replace(/\s+/g, ' ');
  const m = bodyText.match(/merge\s+\d+\s+commits?\s+into\s+(\S+)\s+from\s+(\S+)/i);
  const titleEl = document.querySelector('.js-issue-title');
  const hr = node && node.headRepository;
  return {
    base: (node && node.baseRefName) || (m && m[1]) || null,
    head: (node && node.headRefName) || (m && m[2]) || null,
    baseSha: (node && node.baseRefOid) || null,
    headSha: (node && node.headRefOid) || null,
    headRepoName: (hr && hr.name) || null,
    headRepoOwner: (hr && hr.owner && hr.owner.login) || null,
    title: (node && node.title) || (titleEl && titleEl.textContent ? titleEl.textContent.trim() : null),
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Build PrRefs from the injected raw result (handles fork "owner:branch"). */
export function buildRefsFromRaw(raw: RawPageRefs | null | undefined, owner: string, repo: string): PrRefs | null {
  if (!raw?.head) return null;
  const head = splitRefTitle(raw.head);
  const base = raw.base ? splitRefTitle(raw.base) : null;
  const sha = (s: string | null) => (s && /^[0-9a-f]{40}$/i.test(s) ? s : undefined);
  return {
    baseOwner: owner,
    baseRepo: repo,
    baseRef: base?.ref || 'main',
    baseSha: sha(raw.baseSha),
    headOwner: raw.headRepoOwner || head?.owner || owner,
    headRepo: raw.headRepoName || head?.repo || repo,
    headRef: head?.ref || raw.head,
    headSha: sha(raw.headSha),
    title: raw.title || undefined,
  };
}

/** Inject a fresh reader into the page (immune to stale content scripts). */
async function refsViaInjection(tabId: number, owner: string, repo: string): Promise<PrRefs | null> {
  if (!chrome.scripting?.executeScript) return null;
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: readRefsInPage });
    return buildRefsFromRaw(results?.[0]?.result as RawPageRefs | undefined, owner, repo);
  } catch {
    return null;
  }
}

/** Ask the active tab's content script to read refs off the live DOM. */
async function refsFromContentScript(tabId: number): Promise<PrRefs | null> {
  try {
    const res = await sendToTab(tabId, { type: 'GET_PR_REFS' });
    if (res.ok && 'refs' in res) return (res.refs as PrRefs | null) ?? null;
  } catch {
    /* content script not present */
  }
  return null;
}

/**
 * Resolve base/head refs for a PR. Reads the LIVE DOM first (fresh injected
 * script → content-script message), then falls back to fetching the PR HTML.
 * Throws when none yield a usable head ref.
 */
export async function resolvePrRefs(
  owner: string,
  repo: string,
  number: number,
  signal?: AbortSignal,
): Promise<PrRefs> {
  const tab = await activeTab();
  if (tab?.id && tab.url?.includes('github.com')) {
    const injected = await refsViaInjection(tab.id, owner, repo);
    if (injected && refsAreUsable(injected)) return injected;
    const viaMsg = await refsFromContentScript(tab.id);
    if (viaMsg && refsAreUsable(viaMsg)) return viaMsg;
  }

  const url = `https://github.com/${owner}/${repo}/pull/${number}`;
  const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal });
  if (!res.ok) throw new Error(`resolve PR refs failed: HTTP ${res.status}`);
  const refs = parsePrRefs(await res.text(), owner, repo);
  if (!refsAreUsable(refs)) {
    throw new Error('could not read base/head refs from the PR page (open the PR’s Conversation tab and retry)');
  }
  return refs;
}
