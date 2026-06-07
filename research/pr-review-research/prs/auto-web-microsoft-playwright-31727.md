# microsoft/playwright #31727 — feat(test runner): `--only-changed` option

**[View PR on GitHub](https://github.com/microsoft/playwright/pull/31727)**

| | |
|---|---|
| **Author** | @Skn0tt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dgozman
> I think this makes the `a.spec.tsx` -> `helper.tsx` -> `components/Button.tsx` not work, because we are only going over the flat list of `externalDependencies` when collecting affected files.

### @dgozman
> Let's not go through `createFileFiltersFromArguments` to avoid unnecessary regular expressions. We should know the exact list of test files affected, so we can do a direct comparison.

### @dgozman
> Perhaps we should print the `git` output to make it easier to diagnose issues?

### @dgozman
> To properly test this case, you need one more file that does not depend on `question.ts`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
