# ghostty-org/ghostty #7608 — Add SSH Integration Configuration Option

**[View PR on GitHub](https://github.com/ghostty-org/ghostty/pull/7608)**

| | |
|---|---|
| **Author** | @jasonrayne |
| **Status** | ✅ merged |
| **Opened** | 2025-06-16 |
| **Repo importance** | ★55,978 · 2,849 forks · score 72,369 |
| **Diff** | +1284 / −9 across 10 files |
| **Engagement** | 33 conversation · 230 inline review comments |

## Top review comments (ranked by reactions)

### @mitchellh — 9 reactions  
`❤️ 3 · 🎉 2 · 🚀 4`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-3053274167)

> Okay, just pushed a major refactor of the Zig stuff:
> 
> * I made all the IO part of a single `DiskCache` struct
> * All the IO is now unit tested and its trivial to add new unit tests. I found a few bugs (now fixed).
> * We previously wrote to a temporary file in pwd first. We may not have permission to write to pwd, so we now use a temporary directory in the temp directory (and clean it up).
> * Update also fixes up file permissions (not just add)
> * Added a lot more comment coverage
> * `shell_integration.setupFeatures` now puts the features in sorted order in the env var (done at comp time) so we can deterministically test it

### @mitchellh — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-3014062513)

> Thanks @jasonrayne. I'll reiterate my appreciation for you. The work here has been good, every iteration has been an improvement, and your reception to feedback and discussion has been excellent. Thank you.

### @mitchellh — 4 reactions  
`👍 2 · 🚀 2`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-2980567083)

> Okay had some extra time this morning so I read the other feedback. 
> 
> @pluiedev @jcollie I agree that we should have a `ghostty +ssh` option as well, but I see this as an `and` and not an `or`. In fielding the many, many complaints about the `TERM` issue with SSH, I think that this solution will bridge the gap for a ton of users. Obviously, this direction was endorsed by me, so this viewpoint shouldn't be surprising.
> 
> I'd love to see a `ghostty +ssh` option as well (separately). And I think if we ever do the `ghostty +ssh` CLI, we can also possibly reimplement `ssh-integration` config in the shell integration to just setup aliases to that rather than the logic they're doing now.

### @jasonrayne — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-3009692761)

> > I left some comments on the bash implementation and will wait to take a pass on the other shell integrations based on any changes coming out of that.
> 
> Sounds good! I've got a pretty full day, but I'll address those as soon as I can.
> 
> > Also, now that I see how basic the operations in the `ghostty-ssh-cache` script are, I think it probably makes more sense to do this in Zig instead, especially because you'd had success with adding new CLI actions. Sorry for the churn, but I definitely feel like this gets better on every iteration.
> 
> Thanks for the feedback, and no worries about the churn! Mitchell's concerns have been weighing on me anyway, so I'm actually glad you're pushing for the Zig approach. I'd much rather ship a *good* solution over an *acceptable* solution any day. I'm eager to dig into these changes! 🚀

### @jasonrayne — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-3053407735)

> @mitchellh Wow, major refactor is right... those changes look awesome! Definitely going to dig through all of that tonight to get a better understanding of how you approached everything.
> 
> And really, thank _you_ for giving me the opportunity to take a shot at this. Huge props to jparise, pluiedev, and 00-kat for all their helpful guidance and feedback along the way, too. I learned a ton from the whole experience, especially since this was my first time really getting hands-on with Zig.
> 
> Pretty wild seeing what my little 7-line bash wrapper turned into, lol. Super happy I could contribute something useful back to a tool I use every day. 👻

### @pluiedev — 2 reactions  
`👍 2`  ·  [link](https://github.com/ghostty-org/ghostty/pull/7608#issuecomment-2978264343)

> Also I think we should consider an approach that might be less intrusive for the user. I find how [Kitty](https://sw.kovidgoyal.net/kitty/kittens/ssh/#how-it-works) does it to be pretty ingenious, but since it's GPL code we can't look at it exactly. We can definitely still try to piece it together just through the broad-picture description, though.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
