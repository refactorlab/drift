# koala73/worldmonitor #106 — Proto-first API rebuild: sebuf contracts, handlers, gateway, and generated docs

**[View PR on GitHub](https://github.com/koala73/worldmonitor/pull/106)**

| | |
|---|---|
| **Author** | @SebastienMelki |
| **Status** | ✅ merged |
| **Opened** | 2026-02-18 |
| **Repo importance** | ★55,871 · 8,965 forks · score 96,727 |
| **Diff** | +32566 / −15450 across 399 files |
| **Engagement** | 27 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @koala73 — 1 reactions  
`👍 1`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3937653586)

> @SebastienMelki please review :
> 
> **One issue that will impact Tauri app**
> 
> **P2: OpenSky fallback to removed route — VALID, Medium Impact**
> 
> api/opensky.js is deleted, but the client-side src/services/military-flights.ts:22 still falls back to /api/opensky when VITE_WS_RELAY_URL is unset. The client was not migrated to use the new sebuf RPC client. Production likely has VITE_WS_RELAY_URL set (so it's fine there), but tauri app / dev/staging environments without it will silently get no military flight data.

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3932527764)

> @koala73 All three Vercel deployment checks are failing but the logs are behind auth so I can't access them directly.
> 
> The previous failure (commit `5ebd207`) was caused by:
> 1. **`api/usni-fleet.js` importing `_upstash-cache.js`** — both files are now deleted on this branch
> 2. **TS errors in old monolithic handler.ts files** — all 17 handlers are now split into clean per-RPC modules that pass `tsc`
> 3. **Duplicate keys in `api/data/city-coords.ts`** — fixed in `7123a3e`
> 
> Could you share the latest Vercel build logs so we can see if there's a new/different error? The checks visible on the PR might be stale from the older commit.

### @koala73 — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3933033529)

> # PR #106 Diagnostic: Proto-First API Rebuild (sebuf integration)
> 
> **PR:** https://github.com/koala73/worldmonitor/pull/106
> **Branch:** `feat/sebuf-integration` -> `main`
> **Author:** SebastienMelki
> **Date reviewed:** 2026-02-20
> **Scope:** 513 files changed, +60,049 / -13,567 lines
> 
> ---
> 
> ## Executive Summary
> 
> This PR replaces 56 hand-written Vercel edge function API endpoints with a proto-first architecture using "sebuf" -- a custom protobuf toolchain that generates TypeScript clients, server handler interfaces, and OpenAPI docs from `.proto` definitions. All 17 domain services (48 RPCs) are migrated to a single catch-all gateway with generated routing, shared CORS/error middleware, and typed handler implementations.
> 
> **Verdict:** The architecture is sound and well-designed. The proto layer, code generation, and gateway infrastructure are high quality. However, there are **4 critical bugs**, **~13 high-severity issues**, and **949 lines of deleted tests with no replacements** that must be addressed before merge.
> 
> ---
> 
> ## Issue Tracker
> 
> ### CRITICAL (4)
> 
> | # | Area | Issue | File(s) |
> |---|------|-------|---------|
> | C-1 | Handlers / Cyber | **Unbounded in-memory GeoIP cache (memory leak).** `geoCache` Map grows indefinitely -- entries are only evicted on TTL read, never on size. Each request can add 250 IPs. In long-lived serverless containers, this is unbounded memory growth. | `server/worldmonitor/cyber/v1/_shared.ts` |
> | C-2 | Handlers / Cyber | **Filter applied AFTER slice -- returns incorrect results.** Handler slices to `pageSize` first, THEN applies type/source/severi … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3933048374)

> Thanks for the incredibly thorough review @koala73 — this is outstanding feedback.
> 
> ## Action Plan
> 
> I've gone through every issue and here's what I'm tackling now:
> 
> ### Fixing Now (Must-fix before merge)
> 
> | # | Fix | Status |
> |---|-----|--------|
> | **C-2** | Move filters before `.slice(0, pageSize)` in cyber handler | 🔧 Fixing |
> | **C-3** | Atomic `SET ... EX` in Redis helper (single Upstash call) | 🔧 Fixing |
> | **C-4** | Add `AbortSignal.timeout(30_000)` to LLM fetch | 🔧 Fixing |
> | **H-1** | Wrap gateway handler execution in try/catch with CORS-aware 500 | 🔧 Fixing |
> | **H-5** | Add optional chaining / null guards in seismology handler | 🔧 Fixing |
> | **R-1** | Remove `.planning/` from tracked files, add to `.gitignore` | 🔧 Fixing |
> 
> ### Also Fixing (Should-fix before merge)
> 
> | # | Fix | Status |
> |---|-----|--------|
> | **C-1** | Add max-size eviction (LRU cap) to GeoIP cache | 🔧 Fixing |
> | **H-3** | Sanitize error messages: generic text for 5xx, passthrough for 4xx only | 🔧 Fixing |
> | **H-4** | Add `AbortSignal.timeout()` + Redis cache to seismology handler | 🔧 Fixing |
> | **H-6** | Race OpenSky + Wingbits with `Promise.any` instead of sequential fallback | 🔧 Fixing |
> | **H-8** | Add Redis caching (5min TTL) to infrastructure service-status handler | 🔧 Fixing |
> | **M-12/M-13** | Fix HAPI summary field mappings and `iso3` population | 🔧 Fixing |
> 
> ### Acknowledged — Will Track Separately
> 
> These are valid but lower priority. I'll open follow-up issues:
> - **H-2** (cold-start cost — per-domain splitting): Architectural change, needs design
> - **H-7** (32-bit hash): Wil … *[truncated]*

### @koala73 — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3933054239)

> Sorry for the minor conflicts, found bugs i had to fix before flying @SebastienMelki

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/106#issuecomment-3933073417)

> ## Tracking Issues Created
> 
> All deferred items now have GitHub issues with appropriate labels:
> 
> ### High Priority
> | Review ID | Issue | Labels |
> |---|---|---|
> | H-2 | #179 — Reduce cold-start cost (single edge function loads all 17 domains) | `performance`, `area: API` |
> | H-7 | #180 — Replace 32-bit hash with stronger hash for cache keys | `bug`, `area: API`, `area: AI/intel` |
> | H-12 | #181 — Add tests for migrated sebuf handler business logic | `chore`, `area: API` |
> | H-13 | #182 — Cache router construction in Vite dev plugin | `performance`, `chore` |
> 
> ### Medium Priority
> | Review ID | Issue | Labels |
> |---|---|---|
> | M-1 | #183 — Gate localhost CORS patterns behind NODE_ENV | `security`, `area: API` |
> | M-2 | #184 — Reject disallowed origins before OPTIONS handling | `enhancement`, `area: API` |
> | M-3 | #185 — Add trailing-slash normalization in router | `bug`, `area: API` |
> | M-4 | #186 — Log ApiError.body for debugging production issues | `enhancement`, `area: API` |
> | M-5 | #187 — Make fetch error detection more robust | `bug`, `area: API` |
> | M-6 | #188 — Add key namespace/prefix to Redis cache | `bug`, `area: API` |
> | M-7 | #189 — Use GeoCoordinates type and standardize lat/lng naming | `refactor`, `area: API` |
> | M-8 | #190 — Remove dead typed ID wrappers from identifiers.proto | `chore`, `area: API` |
> | M-9 | #191 — Unify error patterns across proto responses | `refactor`, `area: API` |
> | M-10 | #192 — Convert string-typed enum fields to proper proto enums | `refactor`, `area: API` |
> | M-11 | #193 — Add int64_encoding to displacement population fields | `bug`, … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
