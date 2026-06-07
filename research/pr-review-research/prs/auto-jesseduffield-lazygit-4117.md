# jesseduffield/lazygit #4117 — Allow to switch branches in Commit View (#4115)

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/4117)**

| | |
|---|---|
| **Author** | @seflue |
| **Status** | ✅ merged |
| **Opened** | 2024-12-15 |
| **Repo importance** | ★78,963 · 2,860 forks · score 95,391 |
| **Diff** | +145 / −27 across 6 files |
| **Engagement** | 21 conversation · 26 inline review comments |

## Top review comments (ranked by reactions)

### @jesseduffield — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2565004239)

> Re: order of menu items: I'm happy to go with your suggestion @stefanhaller. I feel like we might need to revise this once we've rolled out more of these branch-specific options but I'm happy to go with your approach now.
> 
> Re: menu layout: I agree, no need for colours or separate columns

### @YikChingTsui — 1 reactions  
`👀 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2612122136)

> Thanks for the suggestion, I'll have to try out your workflow for a while first. I guess it's not such a big change just for checking out things.
> 
> For editing I prefer a slower and more manual way of commit first, review the diff, then edit history. It gives me the opportunity to double check my edits. But I can just use edit as a checkout replacement and avoid actually editing with it. Thanks
> 
> (Git's use of names is just odd: using "rebase edit" to "check out" a commit is better than using `checkout`? Git frontends are supposed to provide a better abstraction, but maybe only something like jj can properly fix it)

### @seflue — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2555934171)

> > This is a great start. Did you say you had to learn go for this? That must have been an understatement. :)
> 
> Thanks, but those were actually my first lines of Go code I wrote. But it's not my first programming language, I have to admit. ;)
> > 
> > A few thoughts on the UX:
> > 
> > * In the menu, the option to check out a detached head needs to come first. I do realize that this is probably not going to be the most common choice, but for the muscle memory of existing users it is important that `space, enter` still does the same thing as before.
> 
> Even it is not as convenient for me, I understand, that we do not want to break with the users habits, so I implement it as you requested. My question is: do you think, we could add a configuration option, which would give the user the choice, what comes first? So we can keep the current behavior as default, but guys like me can just configure the application to let branches come first in this menu?
> 
> > * Instead of just showing the raw hash, I'd probably say something like "detached head at selected commit", or "detached head at fa1afe1" (use short hash)
> > * For menus we prefer UIs that don't change based on context; we prefer to always show all potentially available options, and strike out the ones that are not applicable (see the "delete branch" menu for a good example). In this case this means that we should always show the menu; when there are no branches at the selected commit, the second menu entry could say "branch at selected commit", with a DisabledReason explaining that there is none.
> 
> I understand, that this makes sense in a lo … *[truncated]*

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2557493617)

> Hm ok, if you feel so strongly about the detached head option not being the default one, then I should reconsider whether my suggestion is important enough. In general, muscle memory is an important consideration for lazygit, but maybe in this case it's not so much of a deal that it should outweigh the drawbacks. I don't think a configuration option is justified for something like this. Also, personally I very rarely check out a commit as a detached head; most of the time when I want to check out a commit (e.g. in order to test whether it cleanly builds) I just press `e` on it. That's simpler because it's easier to get back to where you came from. Finally, thinking about it, it's actually questionable that people deliberately want to check out a detached head if there's also a local branch pointing to the same commit, so it doesn't seem like an annoying mistake if they check out the real branch accidentally.
> 
> Another reason why I thought the detached head should come first is for consistency with checking out a remote branch, or checking out a branch by name (`c` in the branches panel). But I misremembered that; in those cases, "new local branch" actually comes first, and "detached head" second, so this is actually another reason for doing it your way.
> 
> So, enough reasons to put the local branch(es) first, so let's keep that the way you have it in your branch now.
> 
> For the other issue though, I feel rather strongly about it: I find it confusing if a keybindings sometimes shows a confirmation and other times a menu, depending on context. And I wonder how much of a problem it … *[truncated]*

### @jesseduffield — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2558421380)

> I'm torn about what to show first: even if in this case users are more likely to want to switch to the branch than the commit, the intention is to roll this pattern out for more actions (drop, etc) and if we do that, we should be consistent in the ordering across those actions. I very much want to preserve the muscle memory for dropping commits, and so I think we should just always have the commit as the first option in the menu.
> 
> Worth mentioning some alternative approaches before we commit to this one:
> 1) add a new keybinding for bringing up a menu for the selected branch (with switch/drop/etc)
> 2) add a keybinding for jumping to the selected branch
> 
> Option 2 sounds especially appealing to me as it means we get all the branch options for free without needing to maintain a separate way of interacting with branches, and it's easy to get back to the commits view with a single keypress if you misclicked.

### @seflue — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4117#issuecomment-2558517396)

> > I'm torn about what to show first: even if in this case users are more likely to want to switch to the branch than the commit, the intention is to roll this pattern out for more actions (drop, etc) and if we do that, we should be consistent in the ordering across those actions. I very much want to preserve the muscle memory for dropping commits, and so I think we should just always have the commit as the first option in the menu.
> 
> I understand that and with shortcuts I'm actually agnostic about what comes first. Pushed my current implementation as suggested by @stefanhaller, but with the detached option first. 
> But I actually struggle to get the ~strikethrough~ styling to work for this "no branches available" entry - I'm still not completely convinced, that we actually need this. :roll_eyes: 
> 
> > Worth mentioning some alternative approaches before we commit to this one:
> > 
> > 1. add a new keybinding for bringing up a menu for the selected branch (with switch/drop/etc)
> > 2. add a keybinding for jumping to the selected branch
> > 
> > Option 2 sounds especially appealing to me as it means we get all the branch options for free without needing to maintain a separate way of interacting with branches, and it's easy to get back to the commits view with a single keypress if you misclicked.
> 
> Actually this was what I tried to describe here with  [Option2](https://github.com/jesseduffield/lazygit/issues/4115#issuecomment-2543087566). The `<c-b>` keybinding is still available in the commit view, so I could also go for that. @stefanhaller what do you think?
> 
> What I like about the first app … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
