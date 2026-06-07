# koala73/worldmonitor #3287 — chore(api): sebuf migration follow-ups (post-#3242)

**[View PR on GitHub](https://github.com/koala73/worldmonitor/pull/3287)**

| | |
|---|---|
| **Author** | @SebastienMelki |
| **Status** | ✅ merged |
| **Opened** | 2026-04-22 |
| **Repo importance** | ★55,871 · 8,965 forks · score 96,727 |
| **Diff** | +524 / −50 across 21 files |
| **Engagement** | 15 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294263462)

> @koala73 — checklist item 1 (#3279) landed in `5053b0ee`. ✅ Highest-leverage one is in.
> 
> ## What
> 
> `scripts/enforce-premium-fetch.mjs` — AST-walks `src/`, finds every `new <ServiceClient>(...)` (variable decl OR `this.foo =` assignment), tracks which methods each instance actually calls, and fails if any called method's path is in `PREMIUM_RPC_PATHS` without `{ fetch: premiumFetch }` on the constructor.
> 
> Per-call-site analysis (not class-level) keeps the trade/index.ts pattern clean — `publicClient` with `globalThis.fetch` + `premiumClient` with `premiumFetch` on the same `TradeServiceClient` class — since `publicClient` never calls a premium method.
> 
> Wired into:
> - `npm run lint:premium-fetch`
> - `.husky/pre-push` (right after `lint:rate-limit-policies`)
> - `.github/workflows/lint-code.yml` (right after `lint:api-contract`)
> 
> ## Three latent HIGH(new) #1-class bugs the lint surfaced — all fixed
> 
> | File | Class | Premium method called | Old fetch | Effect on browser pros |
> |---|---|---|---|---|
> | `src/services/correlation-engine/engine.ts` | `IntelligenceServiceClient` | `deductSituation` | (no option — globalThis.fetch) | LLM-assessment overlay on convergence cards never landed |
> | `src/services/economic/index.ts` | `EconomicServiceClient` | `getNationalDebt` | `globalThis.fetch` | National-debt panel rendered empty |
> | `src/services/sanctions-pressure.ts` | `SanctionsServiceClient` | `listSanctionsPressure` | `globalThis.fetch` | Sanctions-pressure panel rendered empty |
> 
> All three swap to `premiumFetch` (single shared client; mirrors supply-chain/index.ts — `premiumFetch` no- … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294292167)

> @koala73 — checklist item 2 (#3277) landed in `59726c0d`. ✅
> 
> Module-scoped `staleNegUntil` timestamp set whenever `fetchStaleFallback` returns null (key missing, parse fail, empty array after `staleToProto` filter, or thrown error). Checked at the entry of `fetchStaleFallback` before the Redis `getRawJson(REDIS_STALE_KEY)` call. Per-isolate state on Vercel Edge — each warm isolate gets its own 30s suppression window. Mirrors the legacy `/api/military-flights` `NEG_TTL = 30_000` behavior.
> 
> Test seam: `_resetStaleNegativeCacheForTests()` exposed for unit tests so they can drive the suppression window without sleeping.
> 
> New test in `tests/redis-caching.test.mjs` pins the three-state contract:
> 1. Stale-empty → reads Redis stale key once, arms negative cache.
> 2. Within 30s window → does NOT re-read stale key.
> 3. After test-only reset → re-reads stale key.
> 
> `18/18` redis-caching tests pass, `typecheck:api` clean, `lint:premium-fetch` clean (still 0 violations).
> 
> Next up: #3278 — `enforce-rate-limit-policies.mjs` regex → `import()`.

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294311422)

> @koala73 — checklist item 3 (#3278) landed in `4e79d029`. ✅
> 
> `scripts/enforce-rate-limit-policies.mjs` now `import()`s `ENDPOINT_RATE_POLICIES` directly from `server/_shared/rate-limit.ts` (newly exported). Same TS module the gateway uses at runtime → no source-of-truth drift possible.
> 
> Runs via `tsx` (already a dev dep, used by `test:data`) so the `.mjs` shebang can resolve a `.ts` import. `npm run lint:rate-limit-policies` script flipped to `tsx scripts/...`. Pre-push wraps it via the npm script so no hook change.
> 
> Verified:
> - Clean: `6 policies / 182 gateway routes`.
> - Negative test (rename a key back to the original `/api/sanctions/v1/lookup-entity` typo): exit 1 with the same incident-attributed remedy.
> - **Reformat test**: split a single-line entry across multiple lines (the failure mode the issue described) → still passes. Object property reads can't be defeated by formatting.
> 
> Next up: checklist items 4+5 — `alertThreshold: 0` coercion + dead `< 0` branch on shipping/v2 webhook proto.

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294333298)

> @koala73 — checklist items 4+5 landed in `0c384a59`. ✅
> 
> ## Proto change
> `alert_threshold` flipped to `optional int32` so the handler can distinguish "partner explicitly sent 0 (deliver every disruption)" from "partner omitted the field (apply default 50)". buf.validate `int32.gte = 0, int32.lte = 100` retained — applies when the field is set.
> 
> ## Handler change
> Coercion `req.alertThreshold > 0 ? req.alertThreshold : 50` → `req.alertThreshold ?? 50`. Dead `< 0 || > 100` runtime branch deleted (proto/wire validation already enforces the range — that branch was unreachable after the previous `> 0` coercion anyway).
> 
> ## Wire contract diff (partner-facing)
> - Omit field: same → 50.
> - Send 1..100: same → that value.
> - **Send 0: previously 50 (silent intent-drop), now 0** — partner opts in to "every disruption" as documented in the proto comment.
> 
> ## Codegen
> Scoped `buf generate --path worldmonitor/shipping/v2` to avoid the toolchain-drift @ts-nocheck loss across unrelated files (per Learning #3 from PR #3242). Re-applied `@ts-nocheck` on the two regenerated files by hand.
> 
> ## Tests
> - `alertThreshold 0 coerces to 50` flipped to `alertThreshold 0 preserved (deliver every alert)`.
> - New: `alertThreshold omitted (undefined) applies legacy default 50`.
> - Dropped the `rejects > 100 with ValidationError` test — the redundant runtime range check is gone, and proto/wire validation isn't reachable from a direct handler invocation. Wire path covered by the sebuf gateway integration. Comment in the test file documents why.
> 
> `18/18` shipping-v2-handler tests pass; `typecheck` + `typecheck:api` … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294379000)

> @koala73 — checklist item 6 (SSRF DNS-rebinding sanity-check) — `ef4abdf5`. ✅ + ⚠️
> 
> ## Finding
> 
> **No webhook delivery worker for shipping/v2 exists in this repo.** I grepped the entire tree (excluding generated/dist/public/node_modules):
> 
> - Only readers of `webhook:sub:*` records: the registration / inspection / rotate-secret handlers themselves.
> - No code reads them and POSTs to the stored `callbackUrl`.
> 
> The `webhook-shared.ts` comment delegated DNS-rebinding mitigation to "the delivery worker" — that worker either lives in the Railway backend (separate repo, not auditable from here) or hasn't been built yet.
> 
> ## What I did
> 
> 1. **Refreshed the `webhook-shared.ts` comment** to spell out the four-step contract the delivery worker MUST follow (re-validate URL → dns.lookup → re-check resolved IP → fetch resolved IP + Host header preserved). The previous one-liner ("the delivery worker must re-resolve") was too easy to miss.
> 
> 2. **Filed #3288** — full acceptance criteria for the delivery worker including the DNS-rebinding contract. Action moves to wherever it actually lives.
> 
> 3. **Did NOT touch `docs/api-shipping-v2.mdx:170`** — that doc claims the delivery worker honors the contract today. If Railway has it and it does → claim is accurate. If not → claim is misleading. I can't verify from here. Your call: confirm Railway side, then either close #3288 or scope down the doc claim. Flagging so it's not assumed-resolved by silence.
> 
> ## Caveat
> 
> I deliberately did NOT build the delivery worker / `safeFetchWebhook` helper here. That's:
> - Out of scope for the followup PR (would be in … *[truncated]*

### @SebastienMelki — 0 reactions  
`—`  ·  [link](https://github.com/koala73/worldmonitor/pull/3287#issuecomment-4294391478)

> @koala73 — bonus: prod smoke on the 5 #3242 alias URLs done. ✅
> 
> Acceptance from your merge note was "old → 200 via rewrite, not 404." All five alias URLs route in prod — none 404.
> 
> | URL | HTTP |
> |---|---|
> | `GET  /api/scenario/v1/templates` (alias) | 401 (gateway auth) |
> | `GET  /api/scenario/v1/list-scenario-templates` (canonical) | 401 (gateway auth) |
> | `POST /api/scenario/v1/run` (alias) | 401 |
> | `GET  /api/scenario/v1/status?jobId=...` (alias) | 401 |
> | `GET  /api/supply-chain/v1/country-products?iso2=US` (alias) | 401 |
> | `GET  /api/supply-chain/v1/multi-sector-cost-shock?iso2=US&...` (alias) | 401 |
> 
> All 401 with body `{"error":"API key required"}` — the gateway auth response, which means routing succeeded.
> 
> **Caveat on the smoke being degenerate:** `/api/scenario/v1/<bogus>` and `/api/supply-chain/v1/<bogus>` also return 401, because each domain has a `[rpc].ts` catch-all that gates auth before route validation. So the smoke can't *distinguish* between "alias file routes" vs "rpc catchall catches it and 401s anyway." Either way the partner-visible behaviour is the same (no 404), which is what the acceptance asked for. The control case — `/api/totally-fake-domain/v1/zzz` (no domain at all) → 404 — confirms 404 is the live behaviour for genuinely unrouted paths, so the 401s above are real.
> 
> For full PRO end-to-end I'd need a signed-in browser session or a real WORLDMONITOR_API_KEY — neither is available from this terminal. Leaving that to your manual pre-merge plan if needed.
> 
> PR is now ready for review.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
