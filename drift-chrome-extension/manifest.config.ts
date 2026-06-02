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
  content_scripts: [
    {
      matches: ['https://github.com/*'],
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
  host_permissions: ['https://*/*'],
});
