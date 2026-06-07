# firecracker-microvm/firecracker #4797 — feat: Enable gdb debugging on x86

**[View PR on GitHub](https://github.com/firecracker-microvm/firecracker/pull/4797)**

| | |
|---|---|
| **Author** | @JackThomson2 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ShadowCurse
> Please squash 1 and 2 commits.

### @roypat
> I outlined in a comment how we might be able to avoid this. Could you have a look at that?

(Context: @roypat raised concerns about passing `Tid`s throughout the codebase, suggesting a refactor to reduce that coupling.)

### @roypat
> how to deal with someone doing `cargo build --feature gdb --target aarch64-unknown-linux-gnu`. At least it should give a nice error message about that not being supported.

### @kalyazin
> Multiple comments on `docs/gdb-debugging.md` requesting clarification and examples in the documentation.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
