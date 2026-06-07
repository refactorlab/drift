# vuejs/pinia #3035 — fix(nuxt): resolve auto-imports in layers

**[View PR on GitHub](https://github.com/vuejs/pinia/pull/3035)**

| | |
|---|---|
| **Author** | @rijkvanzanten |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @posva
> Can you add a test? A simple one like at #2757 is fine

### @rijkvanzanten
> I didn't spot any existing test suites for the Nuxt package, so just another layer to the playground as a way to manually test

### @coderabbitai
> Kit ≥3.19 introduces getLayerDirectories; keeping Nuxt core/schema around 3.19.x avoids subtle type/runtime mismatches

### @coderabbitai
> Store functionality (mutations/actions) to ensure the store is fully operational, not just imported

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
