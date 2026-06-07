# llvm/llvm-project #102323 — [llvm]Add a simple Telemetry framework

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/102323)**

| | |
|---|---|
| **Author** | @oontvoo |
| **Status** | ✅ merged |
| **Opened** | 2024-08-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +708 / −0 across 10 files |
| **Engagement** | 43 conversation · 355 inline review comments |

## Top review comments (ranked by reactions)

### @labath — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2559758805)

> That makes sense. I'm not pushing for this, I just wanted to make sure that this option is considered. Implementation that don't want/need the type information can always implement the forwarding themselves.

### @aeubanks — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2274028023)

> some nits:
> 
> just `[llvm]` is enough in the commit title, no need for `[lib]`
> this PR isn't `Propose`ing, it's adding
> commit titles should not end with a period
> 
> I think I'm missing the background to properly review the contents of this

### @tschuett — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2274164192)

> Please follow https://llvm.org/docs/CodingStandards.html#name-types-functions-variables-and-enumerators-properly.
> Tests and/or a user would help us to better understand the intent.

### @oontvoo — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2275958055)

> @jh7370 Here's the patch adding Telemetry as a common llvm framework that you'd requested. Please review. Thanks

### @oontvoo — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2275970547)

> > Please follow https://llvm.org/docs/CodingStandards.html#name-types-functions-variables-and-enumerators-properly. Tests and/or a user would help us to better understand the intent.
> 
> Again, as mentioned there is NO current user of this - but it will be used by LLDB (see attached patch on my first comment), along with the RFC. I think that should be sufficient to demonstrate how this can be used.

### @tschuett — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/102323#issuecomment-2276203405)

> There are no contributions without tests.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
