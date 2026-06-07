# servo/servo #40365 — Add basic support for handling module scripts in workers

**[View PR on GitHub](https://github.com/servo/servo/pull/40365)**

| | |
|---|---|
| **Author** | @pylbrecht |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Gae24
> I've not tested it locally yet, but I suspect we should explicitly drop \_ar before performing `clear_js_runtime`.

---

*Note: The bulk of the review on this PR took place in inline file-review threads from @Gae24 (on `globalscope.rs`, `dedicatedworkerglobalscope.rs`, `workerglobalscope.rs`, and `module_loading.rs`). Those threads are collapsed as "Outdated"/"Show resolved" on the conversation page and were not retrievable via plain web fetch (they require the GitHub JS UI / API to expand). The comment above — addressing the sequencing requirement that references be dropped before clearing the JS runtime to avoid DOM interaction after runtime shutdown — is the substantive prose recoverable from the public HTML page.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
