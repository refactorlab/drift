# reduxjs/redux-toolkit #4686 — Update @testing-library/react from 13.3.0 to 16.0.1; Fixes #4685

**[View PR on GitHub](https://github.com/reduxjs/redux-toolkit/pull/4686)**

| | |
|---|---|
| **Author** | @isqua |
| **Status** | Merged (November 28, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @EskiMojo14
> The deprecated import is from react-dom/test-utils, which we're not importing from. Importing from React Testing Library is fine, because they already handle the deprecation.

### @isqua
> Since Release v14.0.0 · testing-library/user-event `userEvent.hover` returns a promise, so we need to await here.

### @isqua
> After upgrading dependencies, all the tests for `usePrefetch` started to fail...I replaced `waitMs` with `waitForFakeTimer`

### @aryaemami59
> That should be fixed by #4603.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
