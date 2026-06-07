# microsoft/playwright #32156 — chore(test runner): rebase watch mode onto TestServerConnection

**[View PR on GitHub](https://github.com/microsoft/playwright/pull/32156)**

| | |
|---|---|
| **Author** | @Skn0tt |
| **Status** | ✅ merged |
| **Opened** | 2024-08-14 |
| **Repo** | curated review-culture seed |
| **Diff** | +199 / −271 across 10 files |
| **Engagement** | 20 conversation · 45 inline review comments |

## Top review comments (ranked by reactions)

### @Skn0tt — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/playwright/pull/32156#issuecomment-2288682666)

> Interesting, those tests all pass locally for me! Looks like i'll need to dig deeper.

### @dgozman — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/playwright/pull/32156#issuecomment-2301564129)

> Summary of the offline discussion:
> - remove `onlyChanged` support, emit the same warning as in UI mode;
> - remove `files` option, intersect with `locations` on the caller side;
> - consider switching to `TeleSuiteUpdater` and `testId` filter in a follow up;
> - collect `projectNames` from the first `listTests()` report.

### @Skn0tt — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/playwright/pull/32156#issuecomment-2307227587)

> I've pulled out the chunky refactorings into https://github.com/microsoft/playwright/commit/3fb33e7144de86180c539ad59ea9085554419415 and https://github.com/microsoft/playwright/commit/850436c656fc749a6bb27a50a04507b004b1a34a. This PR should be a little smaller now :)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
