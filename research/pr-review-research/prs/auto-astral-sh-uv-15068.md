# astral-sh/uv #15068 — Use `.rcdata` to store trampoline type + path to python binary

**[View PR on GitHub](https://github.com/astral-sh/uv/pull/15068)**

| | |
|---|---|
| **Author** | @paveldikov |
| **Status** | ✅ merged |
| **Opened** | 2025-08-04 |
| **Repo importance** | ★86,005 · 3,175 forks · score 103,704 |
| **Diff** | +569 / −374 across 16 files |
| **Engagement** | 19 conversation · 99 inline review comments |

## Top review comments (ranked by reactions)

### @samypr100 — 3 reactions  
`👍 3`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3172313630)

> > in replace of dunce crate, we can consider implement our own (small) function as said in [here](https://users.rust-lang.org/t/things-in-std-with-strong-alternatives/83998/10)
> 
> It's a good idea to consider. Although the scope of this PR is already big, so I'd propose we investigate this replacement as part of a different PR to ease on the reviewers. It's not clear to me immediately if there will be any substantial space/bloat savings.

### @paveldikov — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3235339524)

> @T-256 
> 
> > To keep compatible with Py3.7, I'd recommend to add zip (script_data) to end of target file instead of save it on a section of PE format.
> 
> But then it wouldn't work with code-signing, because fixed positioning of the zip blob gets wrecked by code signing tools.
> 
> Also -- the current trampoline is already incompatible with 3.7. (Do we actively want to _reintroduce_ compatibility?)

### @zanieb — 1 reactions  
`👀 1`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3152756072)

> I'm not super qualified to review this idea, cc @samypr100 & @konstin

### @paveldikov — 1 reactions  
`👍 1`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3153008824)

> Added an even sloppier (but working) refactor of `uv-trampoline-builder`. Needs oodles of polish and review.
> 
> It is now verifiably robust to code-signing, so that solves my original problem.
> 
> I have not verified the py3.7 case, though a similar integration test can be added probably very easily? @T-256
> 
> Also note that the Win32 APIs are all really rather `unsafe`. I'm not sure what the right thing to do here is tbh.

### @paveldikov — 1 reactions  
`👍 1`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3154703044)

> > What I'm not very sure of is using it for the script contents. From a code signing perspective is the goal to sign the launcher regardless of what it may end up executing?
> 
> The goal is to be able to sign a (finished) entrypoint executable.

### @samypr100 — 1 reactions  
`👍 1`  ·  [link](https://github.com/astral-sh/uv/pull/15068#issuecomment-3161988505)

> > * I seem to have broken compile on non-Windows as the addition of Win32 API calls now makes `uv-trampoline-builder` not compile on non-Windows at all. I kinda don't know what the right way of going about this is.
> 
> A first step towards unblocking you may be adding `#[cfg(windows)]`, `if cfg!(windows)`, or `[target.'cfg(target_os = "windows")'.dependencies]` at places where there's references to trampoline builder.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
