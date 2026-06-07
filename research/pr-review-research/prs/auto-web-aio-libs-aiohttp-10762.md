# aio-libs/aiohttp #10762 — Remove pytest_plugin

**[View PR on GitHub](https://github.com/aio-libs/aiohttp/pull/10762)**

| | |
|---|---|
| **Author** | @Dreamsorcerer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: This PR's substantive discussion was largely in inline self-review threads (by @Dreamsorcerer) and a CI/CD workflow review (by @webknjaz) whose verbatim prose did not render on the web-fetched page. The reviewer names and the web-retrievable prose are captured below. Context: the PR removes the bundled pytest plugin from aiohttp, directing future maintenance to the separate pytest-aiohttp project.

### @webknjaz
> Missing change log?

### @Dreamsorcerer (self-review inline threads — text not web-retrievable)
> Left multiple self-directed review comments and applied suggestions across test modules (fixtures and test configuration) and CI/CD workflow files; threads were resolved. The verbatim prose did not render on the web conversation page.

### @webknjaz (CI/CD workflow review — text not web-retrievable)
> Reviewed `.github/workflows/ci-cd.yml` regarding workflow configuration changes; the resolved discussion's verbatim prose did not render on the web conversation page.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
