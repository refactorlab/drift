# WebKit/WebKit #57827 — [JSC] Rewrite module loader

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/57827)**

| | |
|---|---|
| **Author** | @heimskr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Jarred-Sumner
> Suggested using `MarkedArgumentBuffer dependencyKeys` for array construction, noting it could be more efficient than constructing an empty array and appending values one-at-a-time. *(reviewer suggestion; exact verbatim wording not captured from the web page)*

### @heimskr
> every test I've run has produced identical output when run with this PR vs. when run with NodeJS, whereas running the tests with JSC prior to this PR will produce incorrect output and (in debug builds) the occasional assertion failure.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
