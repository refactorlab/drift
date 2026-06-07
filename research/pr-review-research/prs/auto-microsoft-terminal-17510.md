# microsoft/terminal #17510 — A minor ConPTY refactoring: Goodbye VtEngine Edition

**[View PR on GitHub](https://github.com/microsoft/terminal/pull/17510)**

| | |
|---|---|
| **Author** | @lhecker |
| **Status** | ✅ merged |
| **Opened** | 2024-07-03 |
| **Repo importance** | ★103,464 · 9,324 forks · score 145,759 |
| **Diff** | +1974 / −17468 across 125 files |
| **Engagement** | 31 conversation · 175 inline review comments |

## Top review comments (ranked by reactions)

### @oising — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2264287948)

> Holy poop nozzles Leonard, that's one mighty PR! Congrats!

### @zadjii-msft — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2261160473)

> An aside: I'm definitely feeling... something, watching my first **truly** big feature here at Microsoft get entirely removed and replaced by something new. We may tell ourselves _it's just code_ but there is a certain sonder in watching thousands of lines of work be retired. I'm really glad we can replace it all with something better and move forward, and I'm gonna try to not be too attached. The kids all grow up and go off to school someday 🥲

### @lhecker — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2382732721)

> The stable version always trails the preview version by 1 release. As such, we'll release 1.22 as stable in about 2-3 months.

### @j4james — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2208576508)

> Two big issues I've noticed so far (just testing in WSL on this branch by itself).
> 
> * `printf "\e[1;1;1,~"` will kill the app.
> * `printf "\e[6n"; read` will generate two `CPR` reports (same thing happens with any query sequence).
> 
> The underlying problem in both cases is that we're letting the sequences be processed by conhost in addition to passing them through, and I think maybe in some cases we shouldn't be doing that, i.e. we need to retain some `IsConsolePty` tests in `AdaptDispatch` to suppress certain operations or at least handle them differently.
> 
> Edit: Actually it's probably easier to put these checks in `ConhostInternalGetSet` rather than `AdaptDispatch`, at least for these two cases.

### @j4james — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2209531964)

> It seems like query responses aren't working at all now. With this test case: `printf "\e[6n"; read` I see nothing until I press a key.
> 
> It looks like that broke in commit 78ae6dda8078560f733617aa31ae01122883996e. Prior to that I got the double response immediately. After that I only got the one response immediately, and had to press a key to see the second response. Then once the double-response was fixed, I got nothing until I pressed a key.

### @j4james — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/microsoft/terminal/pull/17510#issuecomment-2212145687)

> I haven't actually reviewed the code yet, but I've been running some tests with this branch, and noticed a couple of things that have regressed which aren't directly associated with any changes.
> 
> 1. The `C1` control characters are now enabled by default, and can't be disabled. This is because of the `AlwaysAcceptC1` mode that was needed for the previous conpty implementation, but was intended to be removed once we had passthrough.
> 
> 2. There's a bug in the WT alt screen implementation, where enabling mode ?1049 twice resets the cursor position (which I believe it's not supposed to do). I think this bug has always existed, but was hidden by the fact that the cursor position was previously managed on the conhost side. But maybe this can be left for a followup PR.
> 
> 3. WT can't change the screen size, so it can't fully implement `DECCOLM`, and previously we just disabled the mode via an `IsConsolePty` test on the conhost side. However, that test no longer applies, so WT has gained some of the side effects of `DECCOLM` without actually working. I don't think that's a big deal, though, and in some ways could be considered an improvement, but I think we should at least clean up the pointless `IsConsolePty` call now.
> 
> 4. The `DA1` report previously returned different values for conhost and WT, because we needed to indicate support for `DECCOLM` and Sixel in conhost, but not in WT. And again we were using `IsConsolePty` to differentiate between the two, which no longer applies. But if WT is going to be getting Sixel soon anyway, maybe we could drop the `DECCOLM` feature (our implemen … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
