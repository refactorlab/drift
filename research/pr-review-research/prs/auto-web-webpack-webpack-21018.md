# webpack/webpack #21018 — fix: include referenced module's hash in HTML source/inline-style updateHash

**[View PR on GitHub](https://github.com/webpack/webpack/pull/21018)**

| | |
|---|---|
| **Author** | @alexander-akait |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> _Note: The substantive threads here are the author's technical responses to review/Copilot prompts; quotes are as extracted by the web fetch and may be lightly condensed from the original threads._

### @alexander-akait
> module.buildInfo is always populated by the time updateHash runs...The earlier defensive if (buildInfo && …) pattern was dropped explicitly on this PR...on review request to remove dead null-checks

### @alexander-akait
> Deliberate — buildInfo.hash alone is insufficient here...what we need to propagate is changes that ride on the CSS module's dependencies...The watch test html-contenthash-inline-style-url covers exactly this

### @alexander-akait
> Reworked...the sentinel resolution now taps JavascriptModulesPlugin.getCompilationHooks...This runs during createChunkAssets, after createHash populates chunk content hashes

### @alexander-akait
> Intentional — the rule is forward-looking guidance for new/changed code...not a sweep of every legacy comment in the repo...existing long comments aren't load-bearing

### @alexander-akait
> This test is a regression guard for already-working URLDependency behavior...The primary verification lives in html-contenthash-asset-url where the test JS source is separate

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
