# pytest-dev/pytest #13757 — feat: add --require-unique-paramset-ids option skips pytest internal…

**[View PR on GitHub](https://github.com/pytest-dev/pytest/pull/13757)**

| | |
|---|---|
| **Author** | @gomri15 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nicoddemus
> doesn't make more sense for this to be an ini option rather than a command-line flag? I understand this is something one would like to setup permanently for a test suite, rather than something to be passed on the command line on occasion.

### @Zac-HD
> Ideally both, I guess?

### @bluetech
> I don't see a reason for this to be a CLI flag, only ini. Having fewer flags is generally a good thing.

### @bluetech
> if we go with ini only, I think it would make sense to use the name `strict_parametrization_ids` or such, similar to `strict_xfail`, to indicate it's a strictness flag.

### @bluetech
> I made an 'executive decision' to rename the param to `strict_parametrization_ids` and remove the CLI flag...tweaks the comments/messages a bit...added handling of `pytest.HIDDEN_PARAM`

### @bluetech
> As a separate commit, enabled the flag in pytest's own test suite (always good to 'dogfood') and fixed the couple of issues it found (which were actual useless duplicates!).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
