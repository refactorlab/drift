# fastify/fastify #5252 — feat: emit diagnostics_channel events upon routing request

**[View PR on GitHub](https://github.com/fastify/fastify/pull/5252)**

| | |
|---|---|
| **Author** | @tlhunter |
| **Status** | Merged (May 31, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Qard
> Rather than putting the `end` in all the branches you could use try/finally. That also ensures the event still fires if something throws.

### @mcollina
> I can see so many ways this can end badly long term. Can you avoid storing the payload inside reply?

### @mcollina
> Good work! I think a few edge cases are missing: 1. `reply.callNotFound()` 2. Fastify error handlers (nested) 3. routes with `setImmediate(...)` 4. async routes with `setImmediate(...)`

### @jsumners
> I think instrumentation hooks such as these should be in core...The API used in this PR is meant to be a core API.

### @Qard
> I much favour embedding in the library as the diagnostics_channel API...are aimed at very high performance and as close to zero cost as possible.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
