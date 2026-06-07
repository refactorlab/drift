# nexu-io/open-design #3093 — fix(platform): support live system proxy changes

**[View PR on GitHub](https://github.com/nexu-io/open-design/pull/3093)**

| | |
|---|---|
| **Author** | @mrcfps |
| **Status** | ✅ merged |
| **Opened** | 2026-05-27 |
| **Repo importance** | ★59,370 · 6,689 forks · score 91,125 |
| **Diff** | +2641 / −146 across 24 files |
| **Engagement** | 61 conversation · 138 inline review comments |

## Top review comments (ranked by reactions)

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4552824227)

> **Looper fixer round complete** — fddc444
> 
> - ✅ Review comment on `apps/packaged/src/sidecars.ts` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309483587)
>   - I changed apps/packaged/src/sidecars.ts so the packaged daemon no longer injects the startup system proxy snapshot into its inherited env, while web sidecars still can. I also added a regression test in apps/packaged/tests/sidecars.test.ts covering the daemon path that skips system proxy injection.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4552946242)

> **Looper fixer round complete** — 5457cb1
> 
> - ✅ Review comment on `packages/platform/src/index.ts` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309564269)
>   - I removed the misleading resolveSystemProxyEnvCached wrapper, updated the platform test to call resolveSystemProxyEnv directly, and switched the daemon/packaged call sites to the non-cached helper.
> - ✅ Review comment on `apps/packaged/src/sidecars.ts:344` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309564279)
>   - I added a live proxy dispatcher in apps/daemon/src/connectionTest.ts so provider-mode fetches resolve system proxy settings at request time, and covered it with a provider connection test in apps/daemon/tests/connection-test.test.ts.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4553038154)

> **Looper fixer round complete** — 62f78e8
> 
> - ✅ Review comment on `packages/platform/src/index.ts:152` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309665565)
>   - Updated mergeProxyAwareEnv in packages/platform/src/index.ts so lowercase proxy keys beat uppercase variants within a single source before canonicalization, and added a regression test in packages/platform/tests/index.test.ts for mixed-case POSIX env input.
> - • Review comment on `apps/daemon/src/connectionTest.ts:231` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309674471)
>   - Agent did not provide a decision for this thread
> - • Review comment on `apps/daemon/src/connectionTest.ts:219` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309674481)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4553116286)

> **Looper fixer round complete** — 56d1d1c
> 
> - ✅ Review comment on `apps/daemon/src/connectionTest.ts` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309674471)
>   - Updated apps/daemon/src/connectionTest.ts so the live proxy dispatcher always unions localhost, 127.0.0.1, and ::1 into NO_PROXY before constructing EnvHttpProxyAgent. Added a regression test in apps/daemon/tests/connection-test.test.ts that proves a loopback provider probe still succeeds when user NO_PROXY omits localhost.
> - ⏸️ Review comment on `apps/daemon/src/connectionTest.ts:235` (@PerishCode) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309674481)
>   - The broader daemon-wide proxy rollout touches many outbound fetch surfaces beyond this PR’s scoped repair items, and this run also cannot mutate the remote PR body to narrow the claim. I left that thread for a follow-up change rather than expanding this branch across deploy, plugin, media, research, MCP, and telemetry paths.
> - • Review comment on `apps/daemon/src/connectionTest.ts:238` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309712557)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4553162490)

> **Looper fixer round complete** — bc9ce0a
> 
> - ✅ Review comment on `apps/daemon/src/connectionTest.ts:238` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309712557)
>   - Added a regression test in apps/daemon/tests/connection-test.test.ts covering inherited HTTP_PROXY/HTTPS_PROXY with no NO_PROXY and a localhost provider base URL. It confirms the existing loopback NO_PROXY union in apps/daemon/src/connectionTest.ts keeps those probes off the proxy.
> - • Review comment on `apps/daemon/src/connectionTest.ts:794` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309770254)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/3093#issuecomment-4553245583)

> **Looper fixer round complete** — 6a788fe
> 
> - ✅ Review comment on `apps/daemon/src/connectionTest.ts:794` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309770254)
>   - I exported the live proxy dispatcher from apps/daemon/src/connectionTest.ts and reused it across the daemon provider proxy routes in apps/daemon/src/chat-routes.ts, then added coverage in apps/daemon/tests/proxy-routes.test.ts so provider chats now follow the same proxy path as the connection test.
> - • Review comment on `apps/daemon/src/connectionTest.ts:225` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/3093#discussion_r3309803890)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
