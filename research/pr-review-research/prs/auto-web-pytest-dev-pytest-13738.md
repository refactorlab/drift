# pytest-dev/pytest #13738 — Integrate pytest-subtests

**[View PR on GitHub](https://github.com/pytest-dev/pytest/pull/13738)**

| | |
|---|---|
| **Author** | @nicoddemus |
| **Status** | Merged (November 1, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @RonnyPfannschmidt
> I recall we need to fix marking the owning test case as failed if one subtest fails

### @bluetech
> If some or all subtests fail, the parent test is still PASSED, is this intentional?

### @bluetech
> Regarding the name `SUBPASS` etc., I wonder it shouldn't be `SUBPASSED` etc?

### @RonnyPfannschmidt
> we should try to ensure lastfailed does rerun tests with failed subtests before releasing 9.0

### @bluetech
> For some reason the errors are shown as 'Captured log call', seems wrong as there are not log calls

### @nicoddemus
> Now the top-level test will fail with a message in case it contains failed subtests but otherwise does not contain failed assertions

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
