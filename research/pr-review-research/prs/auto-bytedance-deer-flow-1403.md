# bytedance/deer-flow #1403 — feat(gateway): implement LangGraph Platform API in Gateway, replace langgraph-cli

**[View PR on GitHub](https://github.com/bytedance/deer-flow/pull/1403)**

| | |
|---|---|
| **Author** | @rayhpeng |
| **Status** | ✅ merged |
| **Opened** | 2026-03-26 |
| **Repo importance** | ★70,534 · 9,547 forks · score 113,721 |
| **Diff** | +3492 / −66 across 35 files |
| **Engagement** | 22 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @rayhpeng — 2 reactions  
`👍 2`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4139811065)

> > @rayhpeng You currently hold multiple singleton objects via FastAPI's `app.state`. Can you encapsulate the read and write operations related to them into a utility? Perhaps we can add a `helper.py` under the routers/ directory.
> 
> 好的，我修改一下然后commit

### @rayhpeng — 1 reactions  
`👍 1`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4146971479)

> > @rayhpeng The stream API is working fine 👏, but the conversation history keeps disappearing. Please troubleshoot and fix this issue.
> 
> ok，I‘ll fix it asap

### @rayhpeng — 1 reactions  
`👍 1`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4151756617)

> > The stream API is working fine 👏, but the conversation history keeps disappearing. Please troubleshoot and fix this issue.
> 
> @foreleven 
> 
> ### Changes since last review
> 
> Introduced `BaseStore` as the thread metadata layer, replacing the checkpoint-scanning approach for thread listing. This resolves the "only 3 threads returned" issue and lays the groundwork for proper thread CRUD.
> 
> #### New: Store providers (`deerflow/runtime/store/`)
> 
> Added async and sync Store factories that read the same `config.checkpointer` section and return the matching backend (InMemoryStore / AsyncSqliteStore / AsyncPostgresStore). Integrated into the FastAPI lifespan via `AsyncExitStack` in `deps.py`, replacing the hardcoded `InMemoryStore()`.
> 
> #### Refactored: Thread management backed by Store
> 
> All thread CRUD now goes through Store, with internal helpers `_store_get` / `_store_put` / `_store_upsert`. The Store record schema is `{thread_id, status, created_at, updated_at, metadata, values}`, where `values.title` holds the thread title for search results.
> 
> `/threads/search` uses a two-phase strategy:
> - **Phase 1** — Read from Store. O(threads), covers all threads created through the Gateway.
> - **Phase 2** — Backfill from checkpointer. Discovers threads created by LangGraph Server or before the Store migration, writes them into Store on first encounter. This phase converges to empty over time.
> 
> #### Fixed: Title disappearing after generation
> 
> `TitleMiddleware` writes title into graph state (checkpointer), but Store had no `values` field. After `onFinish` triggered a refetch, the Store record retur … *[truncated]*

### @foreleven — 1 reactions  
`👍 1`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4153017373)

> @rayhpeng Please also help fix the lint issues, and I will complete the merge. Looking forward to your implementation of Phase 2.
> 
> ```
> cd backend
> make format
> ```

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4133933465)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/bytedance/deer-flow?pullRequest=1403) <br/>All committers have signed the CLA.

### @foreleven — 0 reactions  
`—`  ·  [link](https://github.com/bytedance/deer-flow/pull/1403#issuecomment-4139793935)

> @rayhpeng You currently hold multiple singleton objects via FastAPI's `app.state`. Can you encapsulate the read and write operations related to them into a utility? Perhaps we can add a `helper.py` under the routers/ directory.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
