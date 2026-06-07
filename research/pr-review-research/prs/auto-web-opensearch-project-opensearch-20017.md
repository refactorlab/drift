# opensearch-project/OpenSearch #20017 — Support for HTTP/3 (server side)

**[View PR on GitHub](https://github.com/opensearch-project/OpenSearch/pull/20017)**

| | |
|---|---|
| **Author** | @reta |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** The most substantive rendered review comments on this PR were authored by the `coderabbitai` review bot. They are included here because they raise concrete design/configuration trade-offs (hardcoding, duplication, internal-API risk) rather than LGTM noise. Human review threads on the rendered page were largely collapsed/resolved.

### @coderabbitai (bot)
> The new `CODEBASE_JAR_WITH_CLASSIFIER` pattern ... behaves as intended ... Please just double-check that no existing plugin policy files or docs relied on the old `@x86_64`-only suffix.

### @coderabbitai (bot)
> Hardcoded HTTP/3 settings (lines 326-330): The idle timeout (5 seconds), max data, stream data, and max streams are hardcoded. Consider exposing these as Settings.

### @coderabbitai (bot)
> Lines 309-324 duplicate much of the HTTP server configuration from the `bind()` method. Consider extracting common configuration into a shared helper.

### @coderabbitai (bot)
> For HTTP/3 branch you call `build()` inside the `configure` lambda ... which likely causes an extra `SslContext` to be created and discarded and is inconsistent with the other branches.

### @coderabbitai (bot)
> `reactor.netty.http.internal.Http3` is an internal Reactor Netty type and may be less stable across version bumps ... you might want to encapsulate this check.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
