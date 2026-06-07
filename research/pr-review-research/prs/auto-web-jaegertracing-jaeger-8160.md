# jaegertracing/jaeger #8160 — [jaeger_mcp] replace logging of MCP methods with tracing

**[View PR on GitHub](https://github.com/jaegertracing/jaeger/pull/8160)**

| | |
|---|---|
| **Author** | @SoumyaRaikwar |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @yurishkuro
> All of this can be achieved with standard OTEL instrumentation for HTTP, why do we need any of this custom code?

### @yurishkuro
> I prefer not to collect metrics, but collect traces that capture tool usage. If someone wants metrics they can then transform traces to metrics using OTEL processors.

### @yurishkuro
> are you doing this just "in case" or did you really encounter a typed nil returned from req.GetSession() ?

### @SoumyaRaikwar
> I reproduced a real panic path when `req.GetSession()` carries a typed-nil session interface value

### @yurishkuro
> The remaining custom logic is limited to MCP semantics that HTTP alone cannot distinguish on a single `/mcp` endpoint

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
