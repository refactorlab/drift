# vitest-dev/vitest #8041 — feat(browser): introduce `toMatchScreenshot` for Visual Regression Testing

**[View PR on GitHub](https://github.com/vitest-dev/vitest/pull/8041)**

| | |
|---|---|
| **Author** | @macarie |
| **Status** | Merged (July 22, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sheremet-va
> Looks very good overall, just some code style issues

### @sheremet-va
> Code looks good to me, but we need a lot more tests for this feature

### @macarie
> I know this creates a circular dependency between this file and `context.d.ts`, was wondering if it's fine tho

### @macarie
> I'm not sure if I should implement that, if each tests waits 100ms...When using Playwright as a provider, consistency should not be an issue because they allow disabling animations.

### @sheremet-va
> If it works, it works 😄

### @macarie
> I moved the types around to what starts to hopefully make some sense. I created a `shared` folder for the types used in both browser and Node environments.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
