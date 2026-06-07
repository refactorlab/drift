# vitest-dev/vitest #8409 — docs: add comprehensive Component Testing guide

**[View PR on GitHub](https://github.com/vitest-dev/vitest/pull/8409)**

| | |
|---|---|
| **Author** | @rinilkunhiraman |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sheremet-va
> After reading the rendered docs, I feel a bit worried about the quality of this guide. Most of it are examples that we already show in the Browser docs, and the other part is not explained enough

### @sheremet-va
> This section feels out of place. While yes, you can write component tests in Node.js, nothing on this page can be used there (browser mode features are limited only to the browser mode, and we only describe them here)

### @sheremet-va
> This section really lacks explanations, these are just empty statements...How? Make sure to reference previous sections

### @sheremet-va
> we recommend `vi.mock(import('../api/userService'))` syntax (applied to all `vi.mock` calls here)

### @sheremet-va
> There is `await expect.element(locator).toBeInTheDocument()`

### @sheremet-va
> That is no longer how provider is specified in Vitest 4. See: [browser documentation]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
