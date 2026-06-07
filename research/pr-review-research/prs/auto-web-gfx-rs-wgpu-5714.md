# gfx-rs/wgpu #5714 — Ensure safety of indirect dispatch

**[View PR on GitHub](https://github.com/gfx-rs/wgpu/pull/5714)**

| | |
|---|---|
| **Author** | @teoxoy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @vntec
> Don't get me wrong, I generally support the idea of more security checks like this (especially for WebGPU), but I feel like injecting a compute dispatch before every single indirect call could be a bit too intrusive for some release builds.

### @teoxoy
> We will probably add a flag to disable this, see #6567.

### @schell
> called `Option::unwrap()` on a `None` value

(reported post-merge, when the indirect buffer binding size calculated to zero — a missing edge case)

### @cwfitzgerald
> See Atomic issue (https://github.com/gfx-rs/wgpu/pull/5714#discussion_r1777618706) and other small nits

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
