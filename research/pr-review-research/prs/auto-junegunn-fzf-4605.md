# junegunn/fzf #4605 — Add fish completion support

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4605)**

| | |
|---|---|
| **Author** | @lalvarezt |
| **Status** | ✅ merged |
| **Opened** | 2025-11-21 |
| **Repo importance** | ★80,879 · 2,806 forks · score 97,099 |
| **Diff** | +1121 / −142 across 11 files |
| **Engagement** | 136 conversation · 56 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @junegunn — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3573811869)

> Thanks for your interest in the project.
> 
> My knowledge and experience with fish are quite limited, and @bitraid has effectively been maintaining the fish module. I respect their judgement, so I'd like to go with their call on this.
> 
> As the project maintainer, I hope the fish completion aligns with the existing ones, particularly in terms of configuration. You may want to update the README and extend the existing integration tests to cover fish.

### @bitraid — 2 reactions  
`👍 2`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3771923270)

> > @bitraid did as you suggested with some minor changes (we already had the native completion logic so I just used that path) and cleaning up the unnecessary variables, what do you think. It feels quite nice now
> 
> I'm glad that you agree, but since this change makes the script work different than the other shells, I think that we should get the OK from the maintainer before applying/working on it.

### @bitraid — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3585108758)

> > @bitraid would you mind running `make itest` on your side, I'm getting some errors with your proposed code. For example
> > 
> > ```diff
> >          # Run fzf
> >          if type -q "$compgen"
> >              set -l result (eval $compgen $dir | eval (__fzfcmd) --query=$fzf_query | string split0)
> > -            and commandline -rt -- (string join -- ' ' $opt_prefix(string escape -n -- $result))$tail
> > +            and commandline -rt -- (string join -- ' ' $opt_prefix(string escape -- $result))$tail
> >          else
> >              set -l result (eval (__fzfcmd) --walker-root=$dir --query=$fzf_query | string split0)
> > -            and commandline -rt -- (string join -- ' ' $opt_prefix(string escape -n -- $result))$tail
> > +            and commandline -rt -- (string join -- ' ' $opt_prefix(string escape -- $result))$tail
> >          end
> > ```
> > 
> > here you rollback this change, but before it was behaving like bash/zsh and this way is different. See that it only fails for fish but the test passes for zsh/bash
> > 
> > ```
> >   5) Failure:
> > TestFish#test_file_completion [test/test_shell_integration.rb:205]:
> > Expected: "cat no\\~such\\~user"
> >   Actual: "cat 'no~such~user'"
> > ```
> > 
> 
> I didn't intentionally revert the `-n` switch. I changed the script before you made this change. I don't mind having this quoting style if it makes the existing tests happy. FYI, `<CTRL-T` does qute-escaping, which is looks better when inserting full names, whereas backslash-escaping is better when doing shell partial completions.

### @bitraid — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3585237284)

> > it seems we're a little bit closer to the end now. Is there anything else you'd like to tweak or can I move it out of draft?
> 
> I think `__fzf_complete_native` should enable multi-selection, which would be valid for most cases, but not so much for `ssh`, `telent`, or when using `set` to only set a variable value. But for not over-complicating things we should globally enable it anyway?
> I also left some replies in code review, I don't know if you saw them.

### @bitraid — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3585314807)

> > > We could also do option completion with fzf, but it would have to be with `-**`/`--**`, otherwise it would be inconsistent.
> > 
> > I already did this part
> 
> Maybe then we should also do the command completion.

### @bitraid — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4605#issuecomment-3591887321)

> > > So you run the tests of `--` for bash where it makes no difference, but not for fish where it could actually be useful?
> > 
> > I'm trying to contribute to this project, that I actually think it's a great one.
> > 
> > I know we haven't agreed on many things. Since the first commit you said that you didn't want this feature, I get it. But let's try to get along.
> > 
> > That said. In the previous message I mentioned my goal was to document the current behavior with those tests. I left enabled the ones that pass and skipped with a note the ones that didn't. Later I proposed an enhancement where we go deeper and define for each shell the test that defines the expected behavior.
> > 
> > What do you think about that? I believe this would help formalize things and help in the future
> 
> I never said that I don't want this feature. I just expressed my doubts on the advantages it will provide over the native functionality, which in contrast to bash/zsh, does a pretty good job. When I saw that you really wanted to work on it, I tried to help as much as I could, and I think that we managed to create a good alternative. Don't take our discussions personally, I too want what's best for the project, that's why I insist on some things. That being said I don't think it's my place to decide about the tests, (I just wanted to understand the logic of its applications), this is exclusively your work and you should do as you see fit. Ultimately it's the maintainers job to decide whats good and whats not.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
