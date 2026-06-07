# helm/helm #12962 — feat: Added multi-platform plugin hook support

**[View PR on GitHub](https://github.com/helm/helm/pull/12962)**

| | |
|---|---|
| **Author** | @stevehipwell |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sabre1041
> Contents of PR causes an error while the released code completes successfully. Tested using the helm diff plugin

### @stevehipwell
> the error should be consistent, but not necessarily identical, to the existing behaviour on Windows. Basically no currently published Helm plugins can support Windows

### @sabre1041
> functionality works. However, I am also receiving the same unit test failures that are being reported by the GH run. Are you able to take a look?

### @gjenkins8
> should we backport this to Helm v3? Currently/now the main branch is the dev branch for Helm 4

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
