# starship/starship #6476 — perf: use `gitoxide` for `git_status` and `git_metrics` modules

**[View PR on GitHub](https://github.com/starship/starship/pull/6476)**

| | |
|---|---|
| **Author** | @Byron |
| **Status** | ✅ merged |
| **Opened** | 2025-01-06 |
| **Repo importance** | ★58,113 · 2,538 forks · score 73,263 |
| **Diff** | +1227 / −203 across 13 files |
| **Engagement** | 22 conversation · 7 inline review comments |

## Top review comments (ranked by reactions)

### @Byron — 4 reactions  
`🚀 4`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2716260197)

> Sorry for the long silence, just as a quick update: this PR isn't forgotten, I just have a very limited amount of time each day and most of it is taken merely by catching up on the more numerous emails. But I will get to it - apologies for the inconvenience.

### @Byron — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2575121582)

> Thanks for asking, that's fair!
> 
> Here is the preliminary results using the WebKit repository with 407k files. Note that only the `git_status` module is implemented right now, and when done, the performance of `git_metrics` will improve greatly to the point where it probably is free.
> 
> ```
> WebKit ( main) +1 [!?] via △ took 4s
> ❯ time /Users/byron/dev/github.com/starship/starship/target/release/starship timings
> 
>  Here are the timings of modules in your prompt (>=1ms or output):
>  git_status   -  2396ms  -   "[!?] "
>  git_metrics  -  2173ms  -   "+1 "
>  directory    -     9ms  -   "WebKit "
>  pulumi       -     4ms  -   ""
>  username     -     1ms  -   ""
>  git_branch   -    <1ms  -   "( main) "
>  cmake        -    <1ms  -   "via △ "
>  line_break   -    <1ms  -   "\n"
>  character    -    <1ms  -   "❯ "
> /Users/byron/dev/github.com/starship/starship/target/release/starship timings  0.97s user 22.49s system 507% cpu 4.621 total
> 
> WebKit ( main) +1 [!?] via △ took 4s
> ❯ time starship timings
> 
>  Here are the timings of modules in your prompt (>=1ms or output):
>  git_status   -  3099ms  -   "[!?] "
>  git_metrics  -  2087ms  -   "+1 "
>  directory    -     2ms  -   "WebKit "
>  pulumi       -     1ms  -   ""
>  git_branch   -    <1ms  -   "( main) "
>  cmake        -    <1ms  -   "via △ "
>  line_break   -    <1ms  -   "\n"
>  character    -    <1ms  -   "❯ "
> starship timings  0.61s user 32.63s system 638% cpu 5.205 total
> ```
> 
> Here we have a 29% speedup compared to Git (Apple M1 Pro). On more powerful machines, the speedup will be more pronounced - I have measured a 2.8x speedup on an M4 Pro Max with maxed … *[truncated]*

### @Byron — 3 reactions  
`🚀 3`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2576390911)

> @davidkna Tomorrow I'd hope I can figure out CI, it's probably something about line endings and/or transformations. With the spellcheck failure I am a bit puzzled on how to configure it.
> 
> Otherwise I am very, very happy with the performance impact of this PR - the difference can be felt and it's snappier. Even WebKit is now within the realm of usable at 1.6s, which on Linux could probably be much faster.
> 
> @pascalkuthe maybe this PR is something you'd want to try out - now `starship` is reaching light-speed also thanks to your tech 🚀.!

### @matchai — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2832210431)

> Thank you so much for all your work getting gitoxide into Starship and @davidkna for the review! 🎉
> Really looking forward to seeing these performance gains!

### @Byron — 2 reactions  
`👍 2`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2878695477)

> Thanks for bringing this up!
> 
> There are a couple of conditions that would make it use the binary:
> 
> * it's enabled via configuration
> * the index is sparse
> * the git filesystem monitor is configured
> 
> https://github.com/starship/starship/blob/daf8d93d27fdc70b110a4a56799d7dc3a10c3810/src/modules/git_status.rs#L252-L254
> 
> Maybe one of these conditions is true for you?
> 
> A good test is to run `starship timings` - if the Git binary is used, the `git_metrics` and `git_status` module will consume about the same time, whereas otherwise one of them will basically be free.

### @Byron — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/starship/starship/pull/6476#issuecomment-2831945303)

> @matchai I have added a commit with an upgrade to the latest (now working) release of `gix`, and hope this PR can be merged with it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
