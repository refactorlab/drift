# reduxjs/redux-toolkit #4127 — Migrate type tests to Vitest

**[View PR on GitHub](https://github.com/reduxjs/redux-toolkit/pull/4127)**

| | |
|---|---|
| **Author** | @aryaemami59 |
| **Status** | Merged (January 29, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mrazauskas
> `.not.toBeAssignable()` is missing as well. This already creates problems in current type tests

(Suggested TSTyche as an alternative tool offering more comprehensive type testing capabilities with better CLI and performance.)

### @mrazauskas
> the following are also passing: `expectTypeOf<RetryOptions>().not.toMatchTypeOf({ maxRetries: 5 })`

(Indicating the test wasn't properly validating the intended constraint.)

### @EskiMojo14
> Vitest is a bit more 'battle tested'. (It's also convenient to use the same tool for both runtime and type tests)

### @mrazauskas
> You can run type tests on specified versions of TypeScript: `tstyche --target 4.7,5.0,latest`

### @EskiMojo14
> flipping the sides is enough and it works

(Practical guidance as a workaround for `toMatchTypeOf` constraints with complex union types.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
