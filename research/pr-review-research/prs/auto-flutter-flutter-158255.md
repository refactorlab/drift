# flutter/flutter #158255 — Implement RawMenuAnchor

**[View PR on GitHub](https://github.com/flutter/flutter/pull/158255)**

| | |
|---|---|
| **Author** | @davidhicks980 |
| **Status** | ✅ merged |
| **Opened** | 2024-11-06 |
| **Repo importance** | ★176,771 · 30,472 forks · score 303,659 |
| **Diff** | +5310 / −1260 across 9 files |
| **Engagement** | 43 conversation · 211 inline review comments |

## Top review comments (ranked by reactions)

### @gspencergoog — 3 reactions  
`❤️ 1 · 🎉 2`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2521142817)

> Sure, I'll take a look. @davidhicks980  Can I just say that I love your visualization video in the PR description!  I wish I had something like that when I was developing the original! Can we (some day, not in this PR) put something like that into the API docs to explain the various parameters?

### @davidhicks980 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2471055095)

> > Impressive work! 🤩
> > 
> > I just reviewed the examples as a starting point. Noticed some formatting nits and one file is missing a newline at the end of the file which makes the 'Linux analyze' CI check red.
> 
> Thanks for the fixes! I should have come back and fixed these a while ago... I appreciate you doing so.

### @davidhicks980 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2476619687)

> @bleroux thank you so much for the test you added. I migrated the _MenuPanel incorrectly, and it would've completely broken any menus that used LayerLink() had the test not caught the issue.
> 
> Otherwise, it looks like everything is fixed... assuming the tree-status changes. Any thoughts before submitting for review? 
> 
> Edit: One potential bug I came across. A menu using LayerLink can overflow the screen without flipping. I'm not sure if this is something to address in the future, though.

### @bleroux — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2476783801)

> > Otherwise, it looks like everything is fixed... assuming the tree-status changes. Any thoughts before submitting for review?
> 
> Great! All checks are green, I think you can mark this PR as 'Ready for review'
> 
> > Edit: One potential bug I came across. A menu using LayerLink can overflow the screen without flipping. I'm not sure if this is something to address in the future, though.
> 
> yes, there are issues to address with the LayerLink. DropdownMenu is the only widget to rely on it and I proposed to revert this usage in https://github.com/flutter/flutter/pull/158930.
> So we can decide on either to remove it from (probably after this PR is merged) and come back to it later or keep it and try to fix it (not part of this PR, I will come back to https://github.com/flutter/flutter/pull/157921, or another solution, when RawMenuAnchor will have landed).

### @bleroux — 1 reactions  
`👍 1`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2505690119)

> FYI, I rebased the PR to synch it with master and pushed a small commit with purely cosmetic changes (missing dots in comments).

### @davidhicks980 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/flutter/flutter/pull/158255#issuecomment-2555956485)

> @nate-thegrate Oh, we should just call it RawMenuPanel! I didn't think too hard about the name. I updated the proposal.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
