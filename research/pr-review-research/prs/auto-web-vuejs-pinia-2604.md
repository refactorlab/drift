# vuejs/pinia #2604 — fix(types): fix storeToRefs state return type

**[View PR on GitHub](https://github.com/vuejs/pinia/pull/2604)**

| | |
|---|---|
| **Author** | @nkeyy0 |
| **Status** | Merged (later reverted, then re-merged) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @posva
> Could you add a test for an options store using a special ref within the `state()` fn too?

### @posva
> Looks good! I need to test locally with the latest dependencies. Or if you have the time could you rebase against `v2`?

### @nkeyy0
> Unfortunately, I won't have access to my laptop for the next 3-4 days and won't be able to rebase

### @posva
> Unfortunately, this wasn't fixing it; it set the returned type of storeToRefs to `any`

### @nkeyy0
> It seems like adding `@internal` to JSDoc somehow changes the build process and `pinia.d.ts` is not generated correctly

### @nkeyy0
> removing `@internal` should fix the issue

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
