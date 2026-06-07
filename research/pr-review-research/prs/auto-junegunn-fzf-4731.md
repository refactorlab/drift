# junegunn/fzf #4731 — fish: Completion script rewrite (SHIFT-TAB)

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4731)**

| | |
|---|---|
| **Author** | @bitraid |
| **Status** | ✅ merged |
| **Opened** | 2026-03-21 |
| **Repo importance** | ★80,879 · 2,806 forks · score 97,099 |
| **Diff** | +243 / −496 across 9 files |
| **Engagement** | 26 conversation · 39 inline review comments |

## Top review comments (ranked by reactions)

### @bitraid — 3 reactions  
`❤️ 1 · 😄 2`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4113262478)

> > ## Option 1
> > * `fzf_complete` - The new, simpler API designed for ease of use
> > * `_fzf_complete` - A compatibility shim aligned with the bash/zsh style for backward compatibility (i.e. fzf args + `--` + mandatory `$argv`)
> 
> Good idea, lets do that.
> 
> > > Make v3.4.0 the minimum required version for both scripts and simplify the code of key-bindings.fish.
> > 
> > Let's go with this. I can't imagine someone installing the latest version of fzf while still being stuck on a 4-year-old version of fish. We should mention it on the CHANGELOG though.
> 
> Great, now there are more commands and more command options available, as well as the command substitution syntax `$()` which can be used inside double quotes.
> 
> I might delay the changes a little because one of my dogs thew my laptop off the desk and now is dead (the laptop not the dog!).

### @junegunn — 3 reactions  
`🎉 3`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4177677615)

> Thanks a lot! Merged to devel branch. I'll release a new version with your work this weekend.

### @junegunn — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4106061927)

> Please take a look at the Copilot comments, but feel free to disregard irrelevant ones. Copilot often speaks nonsense.

### @bitraid — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4162502280)

> > The description part is no longer dimmed. Is this intended?
> 
> The intention is for the descriptions to be searchable (and unless there is an option that I'm not aware of, it is not possible to dim the field), which I think is more useful, don't you agree?
> 
> > And could you elaborate a bit more on `$FZF_EXPANSION_OPTS?`
> 
> The `$FZF_EXPANSION_OPTS` sets the options for when searching expansion lists (the command line token is a wildcard pattern). The main reason is that the filenames in completion lists are escaped (I explain the reason in the PR description) and they belong to the first field (filenames can also have descriptions - for example in `git add` it displays if a file is modified or untracked). So, to set a preview for example, the option should be `--preview="test -f {r1}; and bat -- {r1}"`, while for expansion lists would be `--preview="test -f {}; and bat -- {}`. We could have only `$FZF_COMPLETION_OPTS`, if the files in expansion lists were also escaped (or the files in completion lists were unescaped, but that would have the drawbacks I mention in the PR description), and also have `--delimiter=\x00` to the default expansion list options, so that in both cases `{r1}` would work. Let me know if you prefer that, or if you have a better idea.

### @bitraid — 1 reactions  
`😄 1`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4162604313)

> > I see. I wasn't familiar with the term "expansion list", but I suppose fish users would know it. Sounds fine to me. By the way, this doesn't seem to work. Could you take a look?
> > 
> > ```shell
> > touch 'foo " bar'
> > 
> > git add <shift-tab>
> >   # git add \"foo\ \\\"\ bar\"
> >   # fatal: pathspec '"foo \" bar"' did not match any files
> > ```
> 
> This is an issue with the fish completion function of git. You will notice you get the same result with `<tab>`.

### @junegunn — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4731#issuecomment-4166363838)

> > * The custom post completion function names can be either `_fzf_complete_COMMAND_post` or `_fzf_post_complete_COMMAND`
> 
> Yeah, that's a good strategy. We could adopt it in bash and zsh as well in the future, though I wouldn't worry too much about it in practice.
> 
> > Should I update the README in this PR, or do you prefer to make the changes yourself in `master`?
> 
> Could you update here? I'll make the final edit when I merge your changes from devel to master. Thanks.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
