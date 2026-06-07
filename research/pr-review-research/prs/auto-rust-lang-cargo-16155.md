# rust-lang/cargo #16155 — Implement fine grain locking for `build-dir`

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/16155)**

| | |
|---|---|
| **Author** | @ranger-ross |
| **Status** | ✅ merged |
| **Opened** | 2025-10-26 |
| **Repo** | curated review-culture seed |
| **Diff** | +320 / −75 across 13 files |
| **Engagement** | 21 conversation · 106 inline review comments |

## Top review comments (ranked by reactions)

### @epage — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3572713571)

> In general, something I realized we need to watch out for is the exact circumstances of why we don't always use `-Cextra-filename`, whether it is about file names or the entire path.  This means moving of built content could cause problems
> 
> https://github.com/rust-lang/cargo/blob/8e43074b2365e1f908570d7f5c2ef76b19d1133c/src/cargo/core/compiler/build_runner/compilation_files.rs#L873-L882

### @epage — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3671855167)

> > How should we handle locking for build units that are shared between cargo check and cargo build? The current implementation skips locking them as an MVP design.
> 
> Skipping them means we have race conditions. i would assume the safer route for an MVP would be to lock everything and then iterate from there.

### @epage — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3699811716)

> As much as I'm aware, yes.  I did a pass yesterday and moved the historical section down further to not draw as much attention to it.

### @the8472 — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3476348743)

> > On Linux 1024 is a fairly common default soft limit
> 
> Afaik the main reason this default exists is that programs using the `select` syscall don't run into its limitations. If the hard limit is higher and a program doesn't use select it's ok to raise it.

### @ranger-ross — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3476402228)

> > Afaik the main reason this default exists is that programs using the select syscall don't run into its limitations. If the hard limit is higher and a program doesn't use select it's ok to raise it.
> 
> Correct! in [this](https://github.com/rust-lang/cargo/pull/16155/commits/950dd530f841d49d6ab82779aaf1879f73f05916) commit I added handling to attempt to increase the soft limit if the hard limit is high enough. Otherwise, we fallback to coarse locking.

### @ranger-ross — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/16155#issuecomment-3566780608)

> Finally coming back to this PR now that we have merged #16230.
> I rebased to resolve the conflicts and responded to some of the open threads.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
