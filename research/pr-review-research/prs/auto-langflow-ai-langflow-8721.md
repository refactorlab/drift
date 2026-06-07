# langflow-ai/langflow #8721 — docs: add required API key headers for 1.5

**[View PR on GitHub](https://github.com/langflow-ai/langflow/pull/8721)**

| | |
|---|---|
| **Author** | @mendonk |
| **Status** | ✅ merged |
| **Opened** | 2025-06-24 |
| **Repo importance** | ★149,238 · 9,192 forks · score 191,005 |
| **Diff** | +362 / −178 across 22 files |
| **Engagement** | 32 conversation · 115 inline review comments |

## Top review comments (ranked by reactions)

### @reidab — 0 reactions  
`—`  ·  [link](https://github.com/langflow-ai/langflow/pull/8721#issuecomment-3010883247)

> Not sure if there's a better place to ask this, but since this PR is the clearest place I've seen the auto-login changes laid out and this would need to be mentioned in the docs, I'll start here.
> 
> I see the docs mention creating an API key using the CLI in backend-only cases, but I'm wondering if there's any path or consideration for multiple independent backend-only servers needing the same key.
> 
> I'm running Langflow in Kubernetes using the [langflow-runtime](https://github.com/langflow-ai/langflow-helm-charts/tree/main/charts/langflow-runtime) helm chart. By default, this configuration supports deploying multiple backend-only instances with no central database. Each individual pod runs its own SQLite database and flows are loaded from disk at startup. 
> 
> If I'm running 10 replicas, API calls will be load-balanced between all of them, so I'd need a way for the same API key to work on all instances. Otherwise, all multi-node `langflow-runtime` deployments that aren't using a central DB will break with this change.
> 
> Is there any mechanism to allow seeding of a specific API key instead of generating one on-demand? Are there additional changes needed in the `langflow-runtime` chart? Everything I'm thinking of to work around this externally is kinda janky and involves injecting values directly into the database file, so I'm hoping there's some kind of officially-supported path.

### @jordanrfrazier — 0 reactions  
`—`  ·  [link](https://github.com/langflow-ai/langflow/pull/8721#issuecomment-3014397096)

> @reidab 
> 
> > By default, this configuration supports deploying multiple backend-only instances with no central database. Each individual pod runs its own SQLite database and flows are loaded from disk at startup. ... If I'm running 10 replicas, API calls will be load-balanced between all of them, so I'd need a way for the same API key to work on all instances. 
> 
> Yes, in this configuration, each backend will have their own database and essentially be acting as an isolated Langflow instance. If you're running 10 replicas, you'd need to replicate all resources (flows, api keys, users) to all replicas for load-balanced API calls to each backend to work. Your suggestion of the (janky) insertion of users into the sqlite database file is perhaps the best method currently. 
> 
> I would normally recommend the central database, but I do see the use case where you want to run stateless requests on nodes with pre-loaded flows. Perhaps we can add a `SEED_USERS`, `SEED_API_KEYS`, etc configuration. I'll make that task and see if someone can take a look into that.  
> 
> https://github.com/langflow-ai/langflow/issues/8769


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
