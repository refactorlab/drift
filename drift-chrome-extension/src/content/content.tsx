// Content script entry. Runs on github.com, and on PR pages it:
//   1. parses the Drift sticky comment out of the rendered DOM,
//   2. caches the result for the popup / side panel,
//   3. mounts a Shadow-DOM overlay (launcher + slide-in drawer),
//   4. answers GET_REPORT messages with a fresh scrape.
//
// GitHub is a single-page app (pjax / Turbo), so we re-run on navigation and
// when the comment timeline mutates (the Drift comment may post a few seconds
// after load, or be edited in place).

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { isPrPage, parseReport, parsePrContext } from '../core/parse';
import type { PrContext } from '../core/types';
import { cacheReport, type Message, type Response } from '../core/messaging';
import { setPrContext } from '../state/prContext';
import { InPagePanel } from './InPagePanel';
import themeCss from '../ui/theme.css?inline';
import contentCss from './content.css?inline';

const HOST_ID = 'drift-lens-host';
let root: Root | null = null;
let lastSignature = '';

function ensureHost(): ShadowRoot {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `${themeCss}\n${contentCss}`;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    mount.id = 'drift-mount';
    shadow.appendChild(mount);
    root = createRoot(mount);
  }
  return host.shadowRoot!;
}

function teardown() {
  const host = document.getElementById(HOST_ID);
  if (host) {
    root?.unmount();
    root = null;
    host.remove();
  }
  lastSignature = '';
}

function render() {
  if (!isPrPage()) {
    teardown();
    return;
  }
  const report = parseReport(document);
  // Signature gates re-renders so timeline mutations don't thrash React. It
  // MUST include the PR path so navigating PR→PR (SPA) always re-detects and
  // re-publishes the new PR's context (even if the metrics look similar).
  const signature = JSON.stringify([
    location.pathname,
    report.found,
    report.verdictLabel,
    report.gauges.map((g) => g.display),
    report.sections.length,
  ]);
  if (signature === lastSignature && root) return;
  lastSignature = signature;

  let ctx: PrContext | null = null;
  if (report.found) {
    void cacheReport(report);
    // Publish the full PR context (report + scan-artifact links + audio) for the
    // side panel's chat to attach as grounding.
    ctx = parsePrContext(document);
    if (ctx) {
      console.log(
        '[drift] detected',
        ctx.pr.repo + '#' + ctx.pr.number,
        '· artifacts:',
        ctx.artifacts.map((a) => `${a.name}${a.url ? '(linked)' : '(derived)'}`).join(', '),
        ctx.audio ? '· audio(linked)' : '',
      );
      void setPrContext(ctx);
    }
  }

  ensureHost();
  root?.render(
    <StrictMode>
      <InPagePanel report={report} artifacts={ctx?.artifacts ?? []} hasAudio={!!ctx?.audio} />
    </StrictMode>,
  );
}

// --- SPA navigation + late-arriving comment handling -----------------------

// render() must never throw — an error here used to prevent watch() from ever
// running, so a deferred comment would never be detected.
function safeRender() {
  try {
    render();
  } catch (e) {
    console.warn('[drift] render error', e);
  }
}

let scheduleTimer: number | undefined;
function scheduleRender() {
  window.clearTimeout(scheduleTimer);
  scheduleTimer = window.setTimeout(safeRender, 300);
}

function watch() {
  // GitHub fires these on pjax/Turbo navigations + back/forward.
  for (const ev of ['turbo:load', 'turbo:render', 'pjax:end', 'pageshow']) {
    document.addEventListener(ev, () => scheduleRender());
  }
  window.addEventListener('popstate', () => scheduleRender());

  // The comment timeline is lazy-loaded (<include-fragment>) and can arrive
  // seconds after document_idle — observe the body so we catch it.
  const obs = new MutationObserver(() => scheduleRender());
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse: (r: Response) => void) => {
    if (msg.type === 'GET_REPORT') {
      sendResponse({ ok: true, report: parseReport(document) });
      return true;
    }
    if (msg.type === 'GET_CONTEXT') {
      sendResponse({ ok: true, context: parsePrContext(document) });
      return true;
    }
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }
    return false;
  },
);

// Set up observers/listeners FIRST so a deferred comment is always caught,
// then attempt detection, then retry on a schedule for GitHub's lazy timeline.
console.log('[drift] content script loaded ·', location.pathname);
watch();
safeRender();
for (const ms of [600, 1500, 3000, 6000, 10000]) window.setTimeout(safeRender, ms);
