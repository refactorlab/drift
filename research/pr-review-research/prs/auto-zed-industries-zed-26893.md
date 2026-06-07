# zed-industries/zed #26893 — editor: Add minimap

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/26893)**

| | |
|---|---|
| **Author** | @esimkowitz |
| **Status** | ✅ merged |
| **Opened** | 2025-03-17 |
| **Repo** | curated review-culture seed |
| **Diff** | +1083 / −216 across 21 files |
| **Engagement** | 83 conversation · 40 inline review comments |

## Top review comments (ranked by reactions)

### @MrSubidubi — 9 reactions  
`🎉 9`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2834508437)

> Most of the remaining issues should be fixed now with some additional improvements I believe. The changes in the commits themselves are mostly quite small and contained so that we can easily revert anything that we do not like or do not agree upon. If you want to revert anything or put something I added behind a setting, feel free to let me know.
> 
> @SomeoneToIgnore please note that this PR now includes two fixes for some minor scrolling issues currently present on main (e422f4e3124f9dd81385a98b3e47c48ac26a5828 and within 7f027335633ff6e609f1a5d62e370eea0239b928). These are currently barely noticeable but became much more problematic with the minimap present. I would leave them in this PR if you do not mind. However, if you prefer to review these seperately please let me know and I will extract them to a standalone PR.
> 
> Additionally, my different approach for starting a drag outside the thumb area did not feel good to use at all, so I left it at the simple one - you can now click the minimap and start dragging outside of the thumb area. I initially shared the concerns from https://github.com/microsoft/vscode/issues/21708#issuecomment-283600344. However, somewhat ironically VsCode's scrollbar nowadays has the exact behavior as described in that comment. For me, it felt good and intuitive to use despite the mentioned problem, since I can still see from the minimap thumb position where I am currently at.
> 
> The only remaining issues I left untouched are the settings issue which I would address once @esimkowitz finishes his change (I hope I did not cause any conflicts) and some iss … *[truncated]*

### @esimkowitz — 9 reactions  
`🎉 9`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2869366397)

> Thank you @MrSubidubi @SomeoneToIgnore @shenjackyuanjie for pushing this through, sorry for disappearing at the end, I started a new job and unfortunately couldn't dedicate as much time to this. I love how it turned out!

### @MrSubidubi — 7 reactions  
`🎉 7`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2859814277)

> > Ok. When do you expect to have the minimap merged into zed’s main?
> 
> We are good to go once https://github.com/zed-industries/zed/pull/30049 is reviewed and approved.

### @JosephTLyons — 4 reactions  
`👍 4`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2755576682)

> <img width="1136" alt="SCR-20250326-nwei" src="https://github.com/user-attachments/assets/a35fe62b-2c69-42f7-b0bc-afe8217bb0ad" />
> 
> Ok, got it to work!

### @esimkowitz — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2799909979)

> Been on vacation hence the lack of updates, @MrSubidubi and I are working through some issues with wrapping in https://github.com/esimkowitz/zed/pull/3

### @MrSubidubi — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/zed-industries/zed/pull/26893#issuecomment-2813604779)

> Good news everyone, I just got soft wrap to work properly! 
> 
> This required some changes of slightly larger scope - the minimap editor is now persisted and cloned only once for each editor (outside of the element prepaint). However, with this change, the perfomance is now much better in debug mode and this approach should also be a bit cleaner overall. 
> 
> We will check it some more and finish work on this in https://github.com/esimkowitz/zed/pull/3. If all goes well, we should have it in this branch soon.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
