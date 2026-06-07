# ruby/ruby #9777 — Add Launchable into CI

**[View PR on GitHub](https://github.com/ruby/ruby/pull/9777)**

| | |
|---|---|
| **Author** | @ono-max |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @junaruga
> if you think we cann't use Launchable in the forked repository, it seems the only way to make the CI green in the forked repository is to skip the logic to trigger Launchable in the forked repositories.

### @hsbt
> TESTS variable of `make test-all TESTS=...` is not environmental variable. If `--repeat-count` is not affect with `launchable` integration, we should keep original `test_task`.

### @hsbt
> your request is over requirement for `ruby/ruby` repository...we have some of custom offer from GitHub like `macos-arm-oss`. These offers are only working with `ruby/ruby` repository.

### @nobu
> It feels strange to check the including class, in a module. This module seems expected to work only with that class, why not `include` in that particular class only?

### @junaruga
> Could you explain about the summary ('what' and 'why') of the updates in the following test-unit files?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
