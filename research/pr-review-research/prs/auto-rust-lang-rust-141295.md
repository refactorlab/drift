# rust-lang/rust #141295 — Stabilize `if let` guards (`feature(if_let_guard)`)

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/141295)**

| | |
|---|---|
| **Author** | @Kivooeo |
| **Status** | ✅ merged |
| **Opened** | 2025-05-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +746 / −731 across 148 files |
| **Engagement** | 150 conversation · 110 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @Kivooeo — 16 reactions  
`👍 3 · ❤️ 13`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-3027889615)

> Hi all,
> 
> Unfortunately I’ll be away for at least a few months, so I won’t be able to keep working on stabilizing this feature in the near future.
> 
> The implementation itself is solid, and there aren’t really open questions about how it should work. However, there are still some important things left to do before stabilization:
> 
> - We definitely need tests for the drop order cases @dianne pointed out above. 
> 
> - The bug with drop order where guard bindings are created before pattern bindings. As @dianne explained, that’s intentional for guard value evaluation, but it leads to the problematic drop order where pattern bindings are dropped first
> 
> - Documentation. But I believe it’s best to write it only after fixing the drop order bug. Otherwise we risk documenting something we intend to change.
> 
> - Implementation-wise, there’s no blocker, the problem is mainly the drop order correctness and documenting it.
> 
> We don’t have a specific PR yet for fixing the drop order for if let guards, but @dianne has expressed possible interest in implementing that fix in the future.
> 
> Basically everything else is ready. Once the drop order fix lands, the remaining work is mostly writing exhaustive tests and documentation. And re-run FCP process AFAIU.
> 
> @est31 – would you possibly be interested in taking this over, or picking it up later? No worries at all if not — in the worst case, I’ll be able (hopefully, in my place it's pretty dangerous I would say) to continue this when I’m back. If there are any further changes or adjustments needed, please feel free to push directly to this branch. I’m absolu … *[truncated]*

### @tmandry — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-2916733567)

> I'm happy to stabilize this feature, and it looks ready now. A big thanks to @Kivooeo for the diligent and thorough stabilization work, and to @est31 for their mentorship.
> 
> @rfcbot reviewed

### @Kivooeo — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-2952786792)

> @est31 huge thanks for everything! From the moment I jumped into this feature, you've been there guiding me through all of this. You patiently answered all my questions, helped me understand the complex parts, and when I wanted to try something new and asked to handle the stabilization PR, you trusted me with it even though I was just getting started
> 
> Honestly, most of the work and insights here are yours. You didn't just help technically - you made it possible for someone new like me to actually contribute something meaningful. That kind of mentorship means a lot, really appreciate it!

### @Kivooeo — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-3029072585)

> (little off-topic but i have to say it) Thank you for the kind words! I also hope I’ll be able to return to working on Rust project. I still have some ambitious plans for reorganizing the tests that I wanted to finish this summer, but unfortunately I’ll have to postpone them until next year.
> 
> Regarding my previous message: I think it can serve as a good new starting point and help anyone interested in stabilizing this feature understand where things stand right now. I tried to summarize everything that’s currently relevant and that might help going forward.
> 
> Thanks again to everyone — I’ll definitely be back to work on Rust!

### @traviscross — 3 reactions  
`👍 3`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-2907007171)

> > what's the next step?
> 
> The next step is someone on the lang team proposing that we do this via FCP.
> 
> As it happens, having reviewed the tests and being satisfied that the behavior is what we'd expect, particularly with respect to the drop order, and being satisfied with the answers above about the likely interaction between this and guard patterns, I propose that we accept this stabilization.
> 
> @rfcbot fcp merge
> 
> In doing this, I'll mention that I'd probably prefer for us to later change aspects of the `if let` drop order over an edition.  E.g., I'd like for `if let Some(_) = ..` to drop the value immediately as with other `_` non-bindings.  I might even prefer for temporaries to be dropped before entering the consequent block (perhaps with some explicit syntax to extend these).  So I do have some reservations about, via this stabilization, increasing the surface area of what would be affected by these possible later changes.  But I feel like we shouldn't let that sort of thing stop us from improving the language as it is today by adding desirable features such as this, and I have confidence in our ability to use editions to make these kind of later improvements regardless.

### @traviscross — 3 reactions  
`👍 3`  ·  [link](https://github.com/rust-lang/rust/pull/141295#issuecomment-2969094621)

> Given the near miss -- despite the care we took to avoid it -- it now feels like, for this and these sort of things, maybe we should expect proof that the testing is exhaustive against the code that's expected to be equivalent, e.g. by some automated means to generate tests for all possible cases.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
