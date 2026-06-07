# koala73/worldmonitor #1812 — feat(auth): integrate clerk.dev 

**[View PR on GitHub](https://github.com/koala73/worldmonitor/pull/1812)**

| | |
|---|---|
| **Author** | @koala73 |
| **Status** | ✅ merged |
| **Opened** | 2026-03-18 |
| **Repo importance** | ★55,871 · 8,965 forks · score 96,727 |
| **Diff** | +9924 / −3227 across 44 files |
| **Engagement** | 30 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4087896743)

> ## Phase 10 Progress: Convex Auth Component Setup (Plan 10-01 Complete)
> 
> ### What's done (Plan 10-01)
> 
> **Package swap:**
> - Removed `@better-auth/infra` and old `server/auth.ts` skeleton
> - Installed `@convex-dev/better-auth@0.11.2`
> - Rewrote `src/services/auth-client.ts` to use `crossDomainClient()` + `convexClient()` plugins
> 
> **Convex auth component files created:**
> - `convex/convex.config.ts` — registers the betterAuth component via `app.use(betterAuth)`
> - `convex/auth.config.ts` — JWT/JWKS auth config provider
> - `convex/auth.ts` — better-auth server instance with Convex adapter, `crossDomain` + `convex` plugins, `emailAndPassword` enabled
> - `convex/http.ts` — HTTP router mounting all auth routes under `/api/auth/*` with CORS
> 
> ### What's next (Plan 10-02)
> - Set Convex env vars (`BETTER_AUTH_SECRET`, `SITE_URL`)
> - Add `VITE_CONVEX_SITE_URL` to `.env.local`
> - Deploy to Convex with betterAuth component
> - Verify auth endpoints live at `*.convex.site/api/auth/ok`
> - Verify OIDC/JWKS endpoints working
> - Confirm existing functions (waitlist, counters, contacts) still work
> 
> ### Review focus
> - `convex/auth.ts` — core auth config, plugins, trusted origins
> - `convex/http.ts` — route mounting and CORS
> - `src/services/auth-client.ts` — client-side auth client setup
> - Verify nothing else was broken by the package swap

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4088323178)

> ## Phase 10 Complete: Convex Auth Component Setup ✓
> 
> All plans executed and verified. Auth infrastructure is live.
> 
> ### What's deployed
> - **betterAuth component** registered in Convex with `admin()` + `organization()` plugins
> - **Auth routes** mounted at `*.convex.site/api/auth/*` with CORS
> - **JWKS endpoint** live at `/api/auth/convex/jwks` (RS256 key rotation)
> - **OIDC discovery** at `/api/auth/convex/.well-known/openid-configuration`
> - **Email/password auth** enabled
> - **Cross-domain auth** configured for convex.site ↔ worldmonitor.app topology
> 
> ### Verification results (10/10 must-haves)
> - ✓ `@convex-dev/better-auth@0.11.2` installed, old `@better-auth/infra` removed
> - ✓ Convex app configured with betterAuth component (`app.use(betterAuth)`)
> - ✓ Auth server with Convex adapter, crossDomain, admin, organization plugins
> - ✓ HTTP router mounts auth routes with CORS
> - ✓ `/api/auth/ok` returns 200
> - ✓ JWKS returns valid RS256 keys
> - ✓ OIDC discovery returns full metadata
> - ✓ Existing Convex functions (registrations, contacts, counters) unchanged
> - ✓ Old `server/auth.ts` skeleton deleted
> - ✓ Client auth module uses crossDomainClient + convexClient + adminClient + organizationClient
> 
> ### Note on `@better-auth/infra`
> The `dash()` plugin was dropped because it pulls in SAML/SSO deps (`node:crypto`, `fs`, `zlib`) incompatible with Convex's V8 runtime. User/org management is available via the `admin()` and `organization()` plugins instead.
> 
> ### Files to review
> - `convex/convex.config.ts` — component registration
> - `convex/auth.config.ts` — JWT/JWKS provider
> - `convex/auth.ts` — au … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4088539269)

> ## Phase 11 Complete: Frontend Auth Client + Auth Modal ✅
> 
> @koala — Phase 11 is done and verified. Here's what landed:
> 
> **What was built:**
> - `src/services/auth-state.ts` — reactive auth state with OTT verification for OAuth redirects
> - `src/components/AuthModal.ts` — sign-in/sign-up modal with email/password + Google OAuth button
> - `src/components/AuthHeaderWidget.ts` — header widget showing "Sign In" button or avatar + dropdown
> - Google OAuth configured in `convex/auth.ts` (pending Google Cloud credentials)
> - Session persistence across browser refresh
> - 250+ lines of themed CSS
> 
> **Commits:** `5a6512fd` → `77c5645c` (6 commits)
> 
> **Issues found & fixed during verification:**
> 1. `localhost:3000` was missing from `trustedOrigins` — CORS blocked sign-up from dev
> 2. `admin()`/`organization()` plugins were sending `banned`/`role` fields that the Convex adapter validator rejected — removed for now, will re-add in Phase 12 with `additionalFields` config
> 
> **Tested & approved:**
> - Sign-up → sign-out → sign-in → session persistence all working
> - Google OAuth is code-complete but needs env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
> 
> **Next:** Phase 12 — Email verification, password reset, panel gating

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4089324721)

> ## v2.0 Better-Auth Integration — Progress Update (2026-03-19)
> 
> @koala73 All 4 phases (10-13) executed and UAT in progress.
> 
> ### What's Built
> - **Phase 10**: Convex auth component deployed, old `@better-auth/infra` skeleton removed
> - **Phase 11**: Auth client, modal (sign-in/sign-up/Google OAuth), header widget, session persistence
> - **Phase 12**: Email verification (Resend), password reset flow, auth-reactive panel gating
> - **Phase 13**: Bearer token injection for premium API paths, server-side session validation, gateway fallback auth
> 
> ### UAT Results So Far
> | Feature | Status |
> |---------|--------|
> | Sign up (email/password) | ✅ |
> | Verification email | ✅ |
> | Verification banner | ✅ |
> | Tier badge (Free/Pro) | ✅ |
> | Panel gating (Sign In to Unlock / Upgrade to Pro) | ✅ |
> | Panel gating reactivity (no refresh) | ✅ |
> | Forgot password → reset email | ✅ |
> | Playwright automated tests (6/6) | ✅ |
> | Phase 13 gateway (bearer tokens) | ⏳ Needs Vercel deploy |
> 
> ### Bugs Fixed During UAT
> - Sign In button invisible (white-on-white CSS)
> - Premium panels missing from variant config
> - Sign-up failing (Convex validator rejecting `role` field)
> - Session validation using wrong header format
> - Emails not sending (Convex killing unawaited promises)
> - Wrong from-address domain
> 
> ### Next Steps
> - Deploy to Vercel to test Phase 13 gateway
> - Password reset click-through
> - Admin panel (`dash` plugin) — will add as follow-up phase
> 
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4090988146)

> ## Status Update — Better Auth v2.0
> 
> @koala Hey — here's where things stand.
> 
> ### What's Done
> All 4 phases (10-13) are code-complete and committed:
> - **Phase 10**: Convex auth component setup (deployed, endpoints live)
> - **Phase 11**: Frontend auth client + auth modal (sign up/in/out, Google OAuth, session persistence)
> - **Phase 12**: Email verification, password reset, panel gating — **UAT passed** ✅
> - **Phase 13**: Server-side bearer token gateway for premium endpoints
> 
> ### UAT Results
> | Test | Status |
> |------|--------|
> | Sign up → user in Convex | ✅ |
> | Verification email | ✅ |
> | Verification banner + dismiss | ✅ |
> | Free tier badge / Upgrade CTA | ✅ |
> | Panel gating reactivity | ✅ |
> | Forgot password → reset email | ✅ |
> | Password reset click-through | ✅ |
> | Playwright automated (6/6) | ✅ |
> | Phase 13 bearer token gateway | ⏳ Blocked — see below |
> 
> ### Blocker: Preview Env CORS
> Phase 13 UAT (bearer token gateway) **can't be tested on Vercel preview** — the preview origin (`*.vercel.app`) makes API calls to `api.worldmonitor.app`, which rejects it with CORS errors because the preview origin isn't in the CORS allowlist. This isn't auth-specific — it affects all preview deployments hitting the API subdomain.
> 
> We need to either:
> 1. Add Vercel preview origins to the CORS config on `api.worldmonitor.app`
> 2. Or find another way to test preview API calls against same-origin routes
> 
> Also note: `VITE_CONVEX_SITE_URL` needs to be set on Vercel (alongside `CONVEX_SITE_URL`) — Vite only exposes `VITE_`-prefixed vars to the client bundle. Already added it, just flagging so it doesn' … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/1812#issuecomment-4091180025)

> ## Update — Ready for Review
> 
> @koala All auth phases (10-13) are code-complete. Here's where things stand.
> 
> ### What's Changed Since Last Update
> - Fixed app crash on Vercel preview (`VITE_CONVEX_SITE_URL` undefined — need both `CONVEX_SITE_URL` and `VITE_CONVEX_SITE_URL` set on Vercel)
> - Removed Google OAuth — email/password only for now to simplify the merge
> - Fixed submit button invisible in dark mode (white-on-white)
> - Added `organization()` + `admin()` plugins to better-auth config
> - Deployed plugins to Convex dev environment
> 
> ### What to Test
> **Phase 12 (all passing ✅):**
> - Sign up → user created in Convex
> - Verification email received (check spam)
> - Verification banner shows until verified
> - Free tier badge in dropdown
> - "Upgrade to Pro" / "Sign In to Unlock" CTAs on premium panels
> - Panel gating updates reactively (no refresh needed)
> - Forgot password → reset email → click link → set new password ✅
> 
> **Phase 13 (needs production deploy to test):**
> - Sign in → DevTools Network → premium endpoints (`analyze-stock`, `get-stock-analysis-history`, `backtest-stock`, `list-stored-stock-backtests`) should have `Authorization: Bearer` header
> - Free user hitting premium endpoint → 403
> - Pro user (set role in Convex dashboard) → premium endpoint returns data
> - Static API key (`X-WorldMonitor-Key`) still works unchanged
> 
> ### Known Limitations
> - **Preview CORS**: Vercel previews can't test API calls — preview origin isn't in `api.worldmonitor.app` CORS allowlist. Phase 13 gateway must be tested on production or locally.
> - **Better Auth hosted dashboard**: `@better-auth/infra` (das … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
