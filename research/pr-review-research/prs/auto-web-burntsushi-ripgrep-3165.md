# BurntSushi/ripgrep #3165 — Add RISC-V (riscv64gc-unknown-linux-gnu) CI and release artifacts

**[View PR on GitHub](https://github.com/BurntSushi/ripgrep/pull/3165)**

| | |
|---|---|
| **Author** | @mariano-m13 |
| **Status** | Merged (October 11, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BurntSushi
> I think I'm okay to accept this, but the typical problem with adding targets like this is that the release pipeline doesn't work. Testing it is annoying. I'm happy to do a little work at release time if it doesn't work as-is, but I reserve the right to remove it.

### @BurntSushi
> This section should be removed. The GitHub release binaries are covered at the top.

### @BurntSushi
> Why did you mark this as resolved without removing this section?

### @mariano-m13
> added #[cfg(not(target_arch = 'riscv64'))] to skip these 3 tests. [explaining test failures on RISC-V where compression tool tests were failing]

### @BurntSushi
> [Later reversed the merge decision due to release workflow failures, announcing removal of the artifact pending future improvements.]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
