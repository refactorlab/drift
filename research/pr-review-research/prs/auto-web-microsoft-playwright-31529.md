# microsoft/playwright #31529 — feat: support client certificates

**[View PR on GitHub](https://github.com/microsoft/playwright/pull/31529)**

| | |
|---|---|
| **Author** | @mxschmitt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dgozman
> nit: I'd add an `if` statement at line 199.5 instead. Should it be `PWTEST_CUSTOM_CA`? It confusing has 'do not use' in the env name, and then uses the ca.

### @mxschmitt
> I'd like to make the name clear that this is unsupported. Changed it to `UNSUPPORTED` instead.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
