# jesseduffield/lazygit #3825 — Support hyperlinks from pagers

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/3825)**

| | |
|---|---|
| **Author** | @stefanhaller |
| **Status** | ✅ merged |
| **Opened** | 2024-08-13 |
| **Repo importance** | ★78,963 · 2,860 forks · score 95,391 |
| **Diff** | +163 / −147 across 23 files |
| **Engagement** | 28 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @stefanhaller — 1 reactions  
`👍 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2296091386)

> > LGTM
> 
> Thanks. Note however that this PR currently sits on top of #3836 because it needs some of the changes made there, so I can only merge it once that one is reviewed too.

### @dandavison — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2287533320)

> Hi @stefanhaller, thanks very much! How do I try this branch out?
> 
> My lazygit config is
> 
> ```yaml
> git:
>   paging:
>     colorArg: always
>     pager: delta --light --paging=never --hyperlinks --line-numbers
> ```
> 
> and I'm doing `make run`. I can view diffs inside lazygit that are using delta, but the line numbers don't seem to be clickable.

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2287896983)

> That looks about right, it's basically what I do when I develop. I don't have an idea why it doesn't work for you.
> 
> What terminal are you using? Mac's Terminal.app doesn't support OSC 8 hyperlinks, but I'm sure you know that.

### @dandavison — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2288656952)

> Hm. Just some very quick investigation -- I've confirmed that I am hitting some of the switch cases you added, such as `stateOSCHyperlink`, `stateOSCWaitForParams`, `stateOSCParams`. (Although, I see that I hit those lines whether or not I pass `--hyperlinks` to delta). I'm using Alacritty and hyperlinks work outside lazygit. It might turn out to be something silly on my end as this is the first time I have ever done anything involving building lazygit locally.

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2288679624)

> Hitting switch statements can be misleading in go, the debugger tends to jump around a bit in weird ways. It's safer to set breakpoints in the bodies of the switch cases. Can you confirm that you are hitting line 228 in escape.go (the line `ei.hyperlink += string(ch)`)? You should hit this when passing `--hyperlink` to delta, but not when you don't. Also, note that you need to quit and restart lazygit when you make changes to the config. (This will hopefully change soon.)

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/3825#issuecomment-2288693133)

> Also, a common mistake is that people get the location of the config file wrong. Are you sure you are editing the right one? You can hit `1 e` in lazygit to confirm this.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
