# junegunn/fzf #4534 — Introduce 'raw' mode

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4534)**

| | |
|---|---|
| **Author** | @junegunn |
| **Status** | ✅ merged |
| **Opened** | 2025-09-28 |
| **Repo importance** | ★80,879 · 2,806 forks · score 97,099 |
| **Diff** | +1140 / −493 across 20 files |
| **Engagement** | 55 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @alex-huff — 2 reactions  
`👍 2`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3369716630)

> Another thing about the current behavior is if you navigate around in raw mode with [half-]page-up/[half-]page-down you will likely skip over matches and land on unmatched items. When you switch back to normal mode would it make more sense to pick the closest matched item instead of the last selected matched item?

### @LangLangBart — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3363408177)

> > ```shell
> > HOME='' git log --oneline --format="%C(auto) %cd %h %d %s" -10 --color=always |
> >   FZF_DEFAULT_OPTS='' fzf --ansi --color hidden:strip:dim:strikethrough --raw --query nn
> > ```
> > This should work as expected now.
> 
> ✅ The ability to have uniformly colored non-matching lines in gray works. Thank you.
> 
> > > the dim or strikethrough effect remains partially applied to some lines.
> > 
> > Actually, it's the expected behavior. The dim and strikethrough are from `fg`, not from `hidden`. It's because you have `--delimiter / --nth -1`, which is not the right option for this input.
> 
> ✅ I see. My bad.
> 
> > e7e7bc3 should fix the problem. I really appreciate your reports.
> 
> ✅ Perfect. I'm glad reports were a bit helpful
> 
> ---
> 
> > The only thing which seems still missing for me is navigation without change of selected item or preserving the selection somehow. Here is the scenario:
> 
> @maxaykin preserving a selected line does work for me, I tested it with the command below:
> 
> - generates many input lines
> - searches for "bar$"
> - switches to raw mode once loading is complete
> - keeps my selected line selected
> - pressing 'ctrl-x' to toggle-raw mode lets me see only matching lines again
> 
> ```bash
> printf "%s\n" {a..z}{a..z}{a..z}{a..z}{a..z} |
>   FZF_DEFAULT_OPTS_FILE= FZF_DEFAULT_OPTS= fzf \
>     --bind 'ctrl-x:toggle-raw' --query 'bar$' --bind 'load:enable-raw'
> ```
> 
> <img src="https://github.com/user-attachments/assets/03cd062b-f748-4e61-acde-650e5d29c23d" alt="image.png" style="max-width: 100%; height: auto" loading="lazy" width="500" />

### @LangLangBart — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3363691337)

> > If you accidentally select another matched item while navigating around in raw mode that item will be selected when you switch back to normal mode.
> 
> @alex-huff 
> 
> One approach would be to save the position before switching to raw mode, for
> example as FZF_PROMPT (or to some other FZF env variable/file), and then restore
> the position when switching back.
> 
> 1. start the command, move the selection to 'bar'
> 2. press 'ctrl-x' to switch to RAW MODE
> 3. move from 'bar' to 'baz'
> 4. press 'ctrl-x' to switch to NORMAL MODE
> 5. notice you are back to 'bar'
> 
> ```bash
> printf "%s\n" {a..z}{a..z}{a..z}  |
>   FZF_DEFAULT_OPTS_FILE= FZF_DEFAULT_OPTS= fzf \
>     --query '^ba' --bind 'ctrl-x:transform:
>   if [[ -n $FZF_RAW ]]; then
>     echo "change-header(NORMAL MODE)+disable-raw+change-prompt(> )+pos:$FZF_PROMPT"
>   else
>     echo "change-header(RAW MODE)+enable-raw+change-prompt:$FZF_POS"
>   fi'
> ```
> 
> <img src="https://github.com/user-attachments/assets/9254e807-913b-4860-b850-567a777b80eb" alt="image.png" style="max-width: 100%; height: auto" loading="lazy" width="600" />

### @alex-huff — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3364251137)

> > If we make the stored position local to each mode
> 
> My bad I must have skipped right over this.
> 
> Using `store-pos`/`restore-pos` could the user have the position automatically restored when they go back to normal mode but not the other way around? Assuming the primary use-case of switching to raw mode is to see the surrounding items of a match, it is probably undesirable to have the position jump back to wherever it was when you last left raw mode.
> 
> It seems the user cannot opt in to raw -> normal restoring without also opting in to normal -> raw restoring unless they bind `restore-pos` to a different key than `toggle-raw` and manually invoke it like you suggested.

### @junegunn — 1 reactions  
`😄 1`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3376822427)

> > This way one may suggest using gitk instead of fzf 😄
> 
> Why not? I think that's a fair suggestion.

### @junegunn — 1 reactions  
`😕 1`  ·  [link](https://github.com/junegunn/fzf/pull/4534#issuecomment-3377494147)

> > Anyway, my complaint was about a possible confusion when a user sees no changes after entering a query in "raw" mode if all the displayed items are non-matches. My thought was that a jump to any (the nearest/next?) match would be better.
> 
> I really don't see it that way. Quite the opposite. Raw mode can be seen as a kind of "debug" mode where you can carefully inspect the full list and see exactly which items match the current query. I can change the query and observe which entries on screen match and which don't. Having the viewpoint automatically move would make it much harder to inspect the results. If I want to move across the matches, I can just press `CTRL-N` or `CTRL-P`.
> 
> > Didn't you think about adding more colors for raw mode?
> 
> The answer is no. I don't want more options there.
> 
> > The following is really out of scope of this feature
> 
> I agree, so I hope we can stop discussing about having a separate cursor in raw mode, or adding another navigation mode here.
> 
> > I have just had a try of it and it seems the actions work incorrectly with `--layout=reverse-list`
> 
> That might be a bug. I rarely use the `reverse-list` layout so it's possible that some features haven't been thoroughly tested with it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
