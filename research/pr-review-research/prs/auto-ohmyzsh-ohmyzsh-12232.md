# ohmyzsh/ohmyzsh #12232 — fix(tmux): do not pass empty flags to aliases

**[View PR on GitHub](https://github.com/ohmyzsh/ohmyzsh/pull/12232)**

| | |
|---|---|
| **Author** | @detroyejr |
| **Status** | ✅ merged |
| **Opened** | 2024-02-21 |
| **Repo importance** | ★187,756 · 26,372 forks · score 298,190 |
| **Diff** | +18 / −5 across 1 files |
| **Engagement** | 16 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @moetayuko — 1 reactions  
`👍 1`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1987187444)

> This appears to break tab completion. For instance, "ta\<tab\>" provided completion for open sessions prior to this change. Is there a workaround for it?

### @carlosala — 0 reactions  
`—`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1959078841)

> I'm not 100% sure how to proceed here. I don't use `tmux,` so I'm unsure if this will break the user's workflows. Does in `tmux` 3.3a the commands work the same with `-t` and without it? I kinda understand the purpose of it; if you want a specific session, you just add it, and if not, you leave it there. It's unfortunate that `tmux` decided to make that argument strict.

### @detroyejr — 0 reactions  
`—`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1959645991)

> Ah, yes I think that's correct. As-is this change would break some functionality. 
> 
> I've asked [here](https://github.com/tmux/tmux/issues/3836#issuecomment-1959596650) to see if anyone might have a good idea.

### @pepoluan — 0 reactions  
`—`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1962250686)

> > Ah, yes I think that's correct. As-is this change would break some functionality.
> > 
> > I've asked [here](https://github.com/tmux/tmux/issues/3836#issuecomment-1959596650) to see if anyone might have a good idea.
> 
> I responded in that issue, that I think the alias needs to be turned into a function so it can leverage the `${VAR:+sub}` pattern.
> 
> For example, the `ta` alias will need to be converted to:
> 
> ```zsh
> function ta() {
>     tmux attach-sessions ${1:+-t }$1
> }
> ```
> 
> Other aliases using `-t` might need the same treatment.
> 
> The downside is of course that simply doing `alias` will no longer show `ta`.

### @detroyejr — 0 reactions  
`—`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1962256945)

> Thank you for the suggestion!
> 
> 4 of the 7 aliases would need to be replaced with functions in order to work with 4.4. I've swapped those aliases out with something that I believe is the correct use of that pattern (let me know if you think otherwise). Looks like it works with both 3.3a and 3.4.

### @detroyejr — 0 reactions  
`—`  ·  [link](https://github.com/ohmyzsh/ohmyzsh/pull/12232#issuecomment-1962402296)

> It does. `tmux new-session -s` without any arguments throws `command new-session: -s expects an argument`. I replaced that as well.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
