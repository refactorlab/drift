# golangci/golangci-lint #4437 — feat: new custom linters system

**[View PR on GitHub](https://github.com/golangci/golangci-lint/pull/4437)**

| | |
|---|---|
| **Author** | @ldez |
| **Status** | Merged (March 11, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bombsimon
> it's not too far from adding my linter as a regular git patch and apply them and re-build golangci-lint. Obviously this would be a more stable interface and better user experience but yeah...

### @bombsimon
> I'm also curious about the decision to bootstrap and build golangci-lint. I know there's been requested to use a specific version of golangci-lint based on the configuration...

### @bombsimon
> You worked a lot with yaegi that the issue links to. Is something like that not suitable at all here?

### @bombsimon
> Btw do you plan to deprecate the current plugin system closely after or will they live in parallel?

### @pohly
> Because we build with go install, adding a file to the build would be more complicated than what we do now.

### @firelizzard18
> It would be nice to have a way for golangci-lint run to automatically build and execute a custom binary...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
