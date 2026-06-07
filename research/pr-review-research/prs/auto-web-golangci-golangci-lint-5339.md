# golangci/golangci-lint #5339 — feat: new linter exclusions system

**[View PR on GitHub](https://github.com/golangci/golangci-lint/pull/5339)**

| | |
|---|---|
| **Author** | @ldez |
| **Status** | Merged (January 28, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ldez
> The main goal is to replace `issue.exclude-xxx` options with `linters.exclusions` section.

### @ldez
> This PR deliberately omits documentation about the new options and section (but the JSONSchema is updated).

### @ldez
> This is because I don't want to deprecate the previous section for now: I think it is better to handle that when all the v2 proposals are managed to avoid multiple migrations.

### @ldez
> Can I do something to ease the review?

### @bombsimon
> Sorry for slow review! I don't think so, mostly just been busy and given your *very* thorough research on this topic in the issue (thanks for that amazing work) I wanted to also catch up with all your findings to better understand these changes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
