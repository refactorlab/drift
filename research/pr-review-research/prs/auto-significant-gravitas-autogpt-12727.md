# Significant-Gravitas/AutoGPT #12727 — feat(platform): subscription tier billing via Stripe Checkout

**[View PR on GitHub](https://github.com/Significant-Gravitas/AutoGPT/pull/12727)**

| | |
|---|---|
| **Author** | @majdyz |
| **Status** | ✅ merged |
| **Opened** | 2026-04-09 |
| **Repo importance** | ★184,771 · 46,188 forks · score 374,523 |
| **Diff** | +3241 / −426 across 13 files |
| **Engagement** | 32 conversation · 392 inline review comments |

## Top review comments (ranked by reactions)

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4216249724)

> @0ubbe The billing page now shows FREE/PRO/BUSINESS tier cards with upgrade/downgrade buttons. When `ENABLE_PLATFORM_PAYMENT=false` (or for beta users), clicking upgrade sets the tier directly. With payment enabled, clicking a paid upgrade creates a Stripe Checkout Session and redirects to Stripe. The `?subscription=success` query param on return triggers a re-fetch. Happy to provide a screen recording once the feature flag is configured in a staging environment.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4216497242)

> ## 🧪 E2E Test Report
> # E2E Test Report: PR #12727 — feat(platform): subscription tier billing
> Date: 2026-04-09
> Branch: feat/subscription-tier-billing
> Worktree: /Users/majdyz/Code/AutoGPT4
> 
> ## Environment
> - Docker services: rest_server, executor, copilot_executor, frontend, websocket_server, scheduler_server, notification_server, database_manager
> - Auth: Claude OAuth token (keychain) for subscription mode
> - Feature flag: `NEXT_PUBLIC_FORCE_FLAG_ENABLE_PLATFORM_PAYMENT=true` enabled for testing
> 
> ## Feature Flag Note
> The subscription tier billing UI is gated behind `enable-platform-payment` flag (default: false). Testing was done with the flag force-enabled via `NEXT_PUBLIC_FORCE_FLAG_ENABLE_PLATFORM_PAYMENT=true` in both backend and frontend .env files.
> 
> ## Note on Stripe Price IDs
> Stripe Price IDs are read from LaunchDarkly feature flags (e.g. `stripe-pro-price-id`). In local dev, LD returns empty strings, so upgrading to paid tiers returns "Subscription not available for tier X". This is expected behavior — the unit tests mock this correctly with `test_update_subscription_tier_paid_beta_user` and `test_create_subscription_checkout_returns_url`.
> 
> ## Test Results
> 
> ### Scenario 1: DB migration — subscriptionTier column added
> **Steps:**
> 1. Checked Prisma migrations table: `_prisma_migrations`
> 2. Verified `20260326200000_add_rate_limit_tier` applied
> 3. Confirmed `subscriptionTier` column exists in `User` table
> **Expected:** `User.subscriptionTier` column present with `SubscriptionTier` enum type
> **Actual:** Column verified in DB. Note: column not auto-created during `docker com … *[truncated]*

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4219238358)

> @0ubbe https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4216497242

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4222305548)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/Significant-Gravitas/AutoGPT?pullRequest=12727) <br/>All committers have signed the CLA.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4222484257)

> ## Round 3 review response
> 
> Addressed the single new review comment from this round:
> 
> **Sentry [HIGH] – `_cancel_customer_subscriptions` ignored trialing subs** (credit.py:1283-1292)
> - Valid bug. Previously only `status="active"` was queried, leaving trial subs intact so users on a trial who downgraded to FREE (or upgraded paid→paid) would be billed once the trial ended.
> - Fixed in c9a6fac: the function now queries both `active` and `trialing` via two separate `stripe.Subscription.list` calls and cancels every billable sub. Seen sub ids are deduped to guard against a sub transitioning between the two list calls.
> - This fix also automatically propagates to the webhook path (`_cleanup_stale_subscriptions` wraps it) and to `cancel_stripe_subscription` on downgrade-to-FREE, so both downgrade and paid-to-paid upgrade flows are safe.
> - Added two new unit tests: `test_cancel_stripe_subscription_cancels_trialing` (trialing only) and `test_cancel_stripe_subscription_cancels_active_and_trialing` (mixed).
> 
> No other unreplied inline or review-level comments remain on the PR.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12727#issuecomment-4223067004)

> ## Re: Automated Review (review ID 4088716556)
> 
> Thanks for the thorough re-review. Going through the blockers and should-fix items one-by-one against the current `HEAD` (`82dbed63e`) — every technical item flagged is already in place on this branch. The review was submitted against `c9a6facf` at 09:38 UTC, but the fixes were landed across commits `ecc10b90f` / `a11666271` / `c9a6facf7` / `82dbed63e` between 08:44 and 09:59 UTC, so a few of them overlap with the review window. Details below.
> 
> ### Blockers
> 
> 1. **Uncached Stripe Price retrieval on hot path** — Addressed. `get_stripe_price_amount` in `backend/data/credit.py` is wrapped with `@cached(ttl_seconds=300, maxsize=32)`, and the `GET /credits/subscription` handler issues the two lookups in parallel via `asyncio.gather`. Steady-state cost is zero Stripe HTTP calls.
> 2. **No frontend integration tests for billing UI** — Addressed. `SubscriptionTierSection/__tests__/SubscriptionTierSection.test.tsx` (205 lines) covers loading/skeleton, error state, tier-card rendering, upgrade click → Stripe redirect, downgrade confirmation dialog flow, ENTERPRISE message, and `?subscription=success`/`=cancelled` return handling.
> 3. **CLA not signed** — Out of scope for a code fix; flagging for the human reviewer/author to resolve.
> 4. **Lint CI failing** — Addressed. The failure was a Black formatting diff in `_cleanup_stale_subscriptions`, fixed in `82dbed63e`. `lint` check-runs are all green on the current HEAD.
> 5. **No success feedback after Stripe return** — Addressed. `useSubscriptionTierSection.ts` has a ref-guarded `useEffect` that … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
