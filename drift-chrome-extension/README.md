# Drift — Chrome extension

A **side-panel chat app** for code review, built on Manifest V3 + React. Click the
toolbar icon and Drift opens in Chrome's side panel beside whatever you're working
on. It has **onboarding**, **Google sign-in (OAuth)**, a **chat surface**, and
**settings**.

> Status: the app shell, auth, onboarding and settings are complete and testable
> locally today. The chat surface is wired end-to-end (composer, transcript,
> model picker, persisted preferences) but has **no model backend yet** — sending
> a message echoes a placeholder until a handler is connected.

```text
toolbar icon ─▶ side panel
                ┌────────────────────────┐
   Onboarding ─▶│ Welcome → Get started   │
       Login  ─▶│ Continue with Google ◯  │   ← OAuth (chrome.identity)
                │ …or dev mode (offline)  │
       Chat   ─▶│ [Sonnet 4.6 ▾]      ⚙   │
                │  How can I help?        │
                │ ┌─────────────────────┐ │
                │ │ Type / for commands │ │
                │ │ ✋ Ask before acting↑│ │
                │ └─────────────────────┘ │
                └────────────────────────┘
```

## Screens

| Screen | File | Notes |
| --- | --- | --- |
| **Onboarding** | [`src/app/Onboarding.tsx`](src/app/Onboarding.tsx) | First-run intro; sets the `onboarded` flag. |
| **Login** | [`src/app/Login.tsx`](src/app/Login.tsx) | Google OAuth button + always-available **Continue as guest**. |
| **Chat** | [`src/app/Chat.tsx`](src/app/Chat.tsx) | Model picker, transcript, composer, ask-before-acting toggle. |
| **Settings** | [`src/app/Settings.tsx`](src/app/Settings.tsx) | Account/sign-out, default model, behavior, theme, clear data. |

State lives in `chrome.storage.local` and is reactive across panels via
[`src/state/useStore.ts`](src/state/useStore.ts) (auth + settings).

## Google login

OAuth uses [`chrome.identity.launchWebAuthFlow`](src/auth/google.ts) with the
implicit flow — no backend, no client secret. To enable it:

1. **Google Cloud Console → Credentials → OAuth client ID → Web application.**
2. Add the extension's redirect URI as an *Authorized redirect URI*. Get it from
   the side-panel devtools console — `chrome.identity.getRedirectURL()` returns
   `https://<extension-id>.chromiumapp.org/`. To keep `<extension-id>` stable
   across reloads, add a `key` to the manifest.
3. Paste the client id into [`src/config.ts`](src/config.ts) (`GOOGLE_CLIENT_ID`).

The Login screen always offers **"Continue as guest"** — a local session (stored
in `chrome.storage.local`, never synced) that needs no Google account. It's the
fastest way to see the app, and the only path until a client id is configured
(at which point the Google button lights up alongside it).

## Run it locally

```bash
npm install
npm run dev          # Vite + CRXJS, writes dist/ and HMRs
```

Then:

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `dist/`.
2. Click the **Drift** toolbar icon → the side panel opens.
3. **Get started** → **Continue as guest** → you're in the chat app. Open
   **⚙ Settings** to switch model/theme, toggle *Ask before acting*, or sign out.

## Build, test, package

```bash
npm run build      # generate icons → typecheck → vite build → dist/
npm run test       # vitest (jsdom) — parser unit + real-comment integration tests
npm run typecheck  # tsc --noEmit (strict)
npm run zip        # build + zip dist/ → release/drift.zip
```

## Automated publishing (CI/CD)

Two workflows cover the extension:

| Workflow | Trigger | Does |
| --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) (`chrome-ext` job) | every PR / push that touches `drift-chrome-extension/**` | `npm ci` → build (incl. `tsc --noEmit`) → `npm test` |
| [`drift-chrome-extension-release.yml`](../.github/workflows/drift-chrome-extension-release.yml) | **push to `main`** that touches `drift-chrome-extension/**` (+ manual dispatch) | build → zip → **publish to the Chrome Web Store** |

**Versioning.** The Web Store rejects re-uploading an existing version, so CI
owns the patch number: the published version is `<major>.<minor>.<run_number>`.
Keep `major.minor` current in [`package.json`](package.json) (the manifest reads
it via [`manifest.config.ts`](manifest.config.ts)); the monotonic run number
guarantees every merge to `main` ships a unique, accepted version. No manual
bump needed — bump `major`/`minor` only for a new headline version.

**Required repo secrets** (Settings → Secrets and variables → Actions):

| Secret | What |
| --- | --- |
| `CWS_EXTENSION_ID` | The extension ID, from its Web Store dashboard URL. |
| `CWS_CLIENT_ID` | Google OAuth2 client id for the Chrome Web Store API. |
| `CWS_CLIENT_SECRET` | OAuth2 client secret. |
| `CWS_REFRESH_TOKEN` | OAuth2 refresh token. |

Mint them once: enable the **Chrome Web Store API** in a Google Cloud project,
create an **OAuth client (Desktop app)** for the `CLIENT_ID`/`CLIENT_SECRET`,
then do the one-time OAuth consent to obtain the `REFRESH_TOKEN` (scope
`https://www.googleapis.com/auth/chromewebstore`). See Google's
[“Using the Chrome Web Store Publish API”](https://developer.chrome.com/docs/webstore/using-api)
guide. ⚠️ A refresh token unused for ~6 months expires — regular merges to
`main` keep it alive.

## Bonus: GitHub PR-health overlay

A content script ([`src/content/`](src/content/)) also runs on `github.com/*/pull/*`.
When a PR has an [Andy / Drift](https://github.com/marketplace/actions/andy-pr-handoff-by-drift)
comment, it parses the merge-confidence gauges and 18-metric Complexity & Risk
report straight out of the rendered comment (no backend) and shows them in a
Shadow-DOM slide-in panel. The parser ([`src/core/parse.ts`](src/core/parse.ts))
is covered by unit + real-comment integration tests.

## Stack

Vite 6 · React 18 · TypeScript (strict) · [`@crxjs/vite-plugin`](https://crxjs.dev)
v2 · Manifest V3. Icons are generated dependency-free by
[`scripts/generate-icons.mjs`](scripts/generate-icons.mjs).

## Permissions

| Permission | Why |
| --- | --- |
| `identity` | Google OAuth via `chrome.identity`. |
| `sidePanel` | The app lives in the side panel; opens on toolbar click. |
| `storage` | Persist session + settings. |
| `host: accounts.google.com, www.googleapis.com` | OAuth + profile lookup. |
| `host: github.com`, `activeTab`, `scripting` | The PR-health overlay. |
