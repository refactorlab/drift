import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Single source of truth for the MV3 manifest. CRXJS rewrites the entry
// paths (popup, side panel, content script, service worker) to their built
// outputs and wires up web_accessible_resources automatically.
export default defineManifest({
  manifest_version: 3,
  name: 'Andy — AI PR review assistant by Drift',
  version: pkg.version,
  description:
    'Chat with Andy, your AI PR-review assistant, in a side panel — opens on any GitHub pull request with its scan context attached.',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    // No default_popup — clicking the toolbar icon opens the side panel
    // (wired in the service worker via openPanelOnActionClick).
    default_title: 'Open Drift',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  // The live scanner runs drift-static-profiler compiled to WebAssembly inside
  // the side panel. MV3's default CSP (`script-src 'self'`) forbids Wasm
  // compilation ("Wasm code generation disallowed by embedder"), so we must opt
  // in with 'wasm-unsafe-eval'. No remote code — the .wasm is packaged.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  // The content script must run on github.com AND on GitHub Enterprise Server
  // hosts (`github.<org>.<tld>`, e.g. github.intuit.com). MV3 match patterns
  // CAN'T express `github.*` — the host wildcard is only valid as the whole host
  // or a leading `*.` label — so we match all https pages and gate at runtime
  // via isGithubHost() (the very first thing content.tsx does is bail on
  // non-GitHub hosts, so no observers/timers are ever set up elsewhere).
  content_scripts: [
    {
      matches: ['https://*/*'],
      js: ['src/content/content.tsx'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'storage',
    'unlimitedStorage',
    'sidePanel',
    'activeTab',
    'scripting',
    // Optional Google sign-in.
    'identity',
    // Download real artifacts using the browser's own GitHub session.
    'downloads',
    // Detect GitHub's Turbo (pushState) PR→PR navigation reliably.
    'webNavigation',
  ],
  // GitHub Actions artifact downloads redirect to unpredictable signed-blob CDN
  // hosts (githubusercontent / Azure blob / sometimes S3). Granting all https
  // hosts makes the background worker's fetch CORS-exempt for ANY redirect
  // target, so a failure can only be auth (404), not host coverage. This is the
  // same access a download-manager extension needs.
  //
  // The local http hosts let the optional Ollama brain reach a local server
  // (http://localhost:11434 by default). Scoped to localhost — a non-default
  // Ollama host would also need OLLAMA_ORIGINS set on that server.
  host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
});
