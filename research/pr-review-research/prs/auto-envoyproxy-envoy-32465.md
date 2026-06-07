# envoyproxy/envoy #32465 — new extension for TLS cert selection

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/32465)**

| | |
|---|---|
| **Author** | @doujiang24 |
| **Status** | ✅ merged |
| **Opened** | 2024-02-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +1708 / −379 across 55 files |
| **Engagement** | 71 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @AmitKatyal-Sophos — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-2128574892)

> @doujiang24 Thanks for adding this feature. Eagerly waiting for it get merged.

### @doujiang24 — 1 reactions  
`😕 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-2197815472)

> seems the Azure Pipelines is blocked.
> 
> /retest

### @RyanTheOptimist — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-2215064721)

> > > @ggreenway Does this look good to you?
> > 
> > Still waiting on resolution to [#32465 (comment)](https://github.com/envoyproxy/envoy/pull/32465#discussion_r1665624849) (which github is now hiding by default on this PR)
> 
> Ah, thanks!
> /wait

### @ggreenway — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-2223657919)

> > > Please add integration tests, specifically for the case where the extension needs to block. You can create a test implementation of the extension to control blocking in the tests.
> > 
> > There are integration tests for both three modes: success, failed, pending(blocking).
> > 
> > https://github.com/envoyproxy/envoy/blob/c41da60c52460f6923bc4a81ed6e3f68f8fc9828/test/common/tls/tls_certificate_selector_test.cc#L348-L358
> 
> None of those are integration tests. I especially want to see an integration test for the case where cert selection blocks, and make sure the entire flow works (pause handshake, and later resume).
> 
> > 
> > > Please make sure to test QUIC in the integration test as well.
> > 
> > Okay, all QUIC tests are passed, it's good to cover this changes.
> 
> The above integration test should cover QUIC as well. But from looking at the code, I don't think an async cert selection will work for QUIC right now, although I think an immediate selection will work. If that's the case, we need to at least document it, and possible make a config-load-error for things that aren't supported.
> 
> /wait

### @ggreenway — 1 reactions  
`👀 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-2226019346)

> > After returning `Pending`, the handshake will be paused; and when `selectTlsContextAsync` run in the post callback, the handshake will resume. Without the post callback, the handshake will be paused until timedout.
> > 
> > Or, maybe I'm missing something?
> 
> There needs to be an integration test, so we can validate that this works in the complete threading model of envoy connection processing, especially the async case, and also the async-timeout case (no async response in a reasonable period of time), and client disconnecting during an async operation to test cancellation.

### @ggreenway — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/32465#issuecomment-1977646536)

> I think you need to separate out the concepts of selecting certificates with custom logic, and fetching additional certificates. See https://github.com/envoyproxy/envoy/issues/30600#issuecomment-1804317692. 
> 
> Having these two halves in separate PRs will make it easier to review.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
