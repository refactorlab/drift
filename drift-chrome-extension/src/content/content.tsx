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
  // Signature gates re-renders so timeline mutations don't thrash React.
  const signature = JSON.stringify([
    report.found,
    report.verdictLabel,
    report.gauges.map((g) => g.display),
    report.sections.length,
  ]);
  if (signature === lastSignature && root) return;
  lastSignature = signature;

  if (report.found) {
    void cacheReport(report);
    // Publish the full PR context (report + scan-artifact links) for the side
    // panel's chat to attach as grounding.
    const ctx = parsePrContext(document);
    if (ctx) {
      console.log(
        '[drift] detected',
        ctx.pr.repo + '#' + ctx.pr.number,
        '· artifacts:',
        ctx.artifacts.map((a) => `${a.name}${a.url ? '(linked)' : '(derived)'}`).join(', '),
      );
      void setPrContext(ctx);
    }
  }

  ensureHost();
  root?.render(
    <StrictMode>
      <InPagePanel report={report} />
    </StrictMode>,
  );
}

// --- SPA navigation + late-arriving comment handling -----------------------

function watch() {
  // GitHub fires these on pjax/Turbo navigations.
  for (const ev of ['turbo:load', 'pjax:end', 'pageshow']) {
    document.addEventListener(ev, () => scheduleRender());
  }
  // History API patches (back/forward + pushState navigations).
  window.addEventListener('popstate', () => scheduleRender());

  // Debounced observer for the comment timeline mutating after load.
  let timer: number | undefined;
  const obs = new MutationObserver(() => scheduleRender());
  obs.observe(document.body, { childList: true, subtree: true });

  function scheduleRender() {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, 400);
  }
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

render();
watch();
