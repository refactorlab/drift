# jekyll/jekyll #9760 — feat!: Streamline the release process for Jekyll

**[View PR on GitHub](https://github.com/jekyll/jekyll/pull/9760)**

| | |
|---|---|
| **Author** | @mattr- |
| **Status** | ✅ merged |
| **Opened** | 2025-01-27 |
| **Repo importance** | ★51,475 · 10,283 forks · score 96,994 |
| **Diff** | +126 / −69 across 7 files |
| **Engagement** | 16 conversation · 18 inline review comments |

## Top review comments (ranked by reactions)

### @mattr- — 3 reactions  
`👍 3`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2619539163)

> > I am not yet entirely clear on the motivation behind this. Is it that we don't ship Jekyll releases as frequently like in the ol' days or is it how our History / changelog document is structured that the maintainer executing the release has to manually decide (whether a commit was correctly triaged as a bug-fix / correction / enhancement / breaking-change) at the time of release?
> 
> Parts of all of that are true. I'd like to see us release more frequently. I'd like users to have more visibility into what the next release might be and have a central place to talk about why we haven't released yet. As a maintainer, I'd like to not have to think about what the next release might be, when with a small set of tweaks, the computer can do that for me. I think the structure of the history / changelog is fine. I do want better management of it, which I feel like release-please gives us by using the PR to update the changelog rather than jekyllbot coming through and updating it after every single merge.
> 
> > I am not entirely in favor of yielding control to a third-party application, (release-please action in this case), mainly because it means we will have to play by their rules. Why can't we simply upgrade JekyllBot do whatever is necessary instead?
> 
> release-please, both the CLI and the action, are open-source under the Apache 2.0 license. I don't see a reason to keep maintaining our own code for this when it can be replaced by code someone else maintains that is also open source. This feels similar to saying that you have to write your own http client because you don't want to use a … *[truncated]*

### @ashmaroli — 0 reactions  
`—`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2618100501)

> Hello Matt,
> 
> I have not yet completely processed this proposal but I would like to leave a few comments based on superficial understanding:
> 
> * I am not yet entirely clear on the motivation behind this. Is it that we don't ship Jekyll releases as frequently like in the ol' days or is it how our _History_ / changelog document is structured that _the maintainer executing the release_ has to manually decide (whether a commit was **correctly triaged as** a bug-fix / correction / enhancement / breaking-change) **at the time of release**?
> * I am not entirely in favor of yielding control to a third-party application, (`release-please` action in this case), mainly because it means we will have to play by their rules. Why can't we simply upgrade JekyllBot do whatever is necessary instead?
> * Labelling is a form of quick visual communication. I am not in favor of ditching those and only infer intent from conventional commit messages.
> * It feels like JekyllBot is gradually being phased-out, onto retirement :p
> * Regardless, I would like to see how this plays out in a real scenario. I suggest that you first implement this process at our repo `jekyll/jekyll-test-gem-plugin`, make dummy commits, publish dummy releases (and gems), and then port the final implementation to repo `jekyll/jekyll`.
> 
> P.S. Renaming `History.markdown` (should it be accepted) warrants a likewise change to our Rakefile as well.
> 
> --------------------------------------------
> 
> > My point of view on this is that we've done a relatively poor job of maintaining [stable branches]
> 
> I am quite surprised by this perspective. Co … *[truncated]*

### @ashmaroli — 0 reactions  
`—`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2619802799)

> > I don't see a reason to keep maintaining our own code for this when it can be replaced by code someone else maintains that is also open source.
> 
> Not a strong argument in favour of my comment about _having to play by their rules_, but we need not have to switch to enforcing _Conventional Commits_ if JekyllBot would be able to replicate the end-result of `release-please` handling changelog management via a single persisting pull-request. That said, I am not proficient in GoLang to even consider submitting a POC towards upgrading JekyllBot codebase. So......
> 
> > most of things jekyllbot does for us can now be done natively in GitHub, mostly with Actions.
> 
> The downside I see regarding this is the time taken for GitHub Actions to execute the workflow (download action code > repository checkout > install dependencies > Run action) in contrast to JekyllBot finishing the action as soon as the underlying webhook is dispatched. But yes, it's just a matter of getting used to the new normal.
> 
> > This is based on the fact that 4.4.0 contains double the number of bugfixes in the 4.3.x release series.
> 
> The reason for this is that there weren't enough changes to warrant shipping a 4.4.0 at the time 4.3.2 - 4.3.4 were shipped, at the same time `master` had changes that can only be considered for a Semver-minor-bump. So, shipping 4.3.x via the stable branches allowed providing beneficial patches to our users at an earlier time.
> 
> > Maintaining stable branches is extra work. If we don't violate semver in minor versions, why should we try so hard to maintain them?
> 
> Sometimes UX-critical patches … *[truncated]*

### @mattr- — 0 reactions  
`—`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2625796871)

> Going to dump updates here as I work on this: 
> 
> Enforcing conventional commits at the PR level looks like so when the check fails:
> <img width="929" alt="PR check that failed when the PR title doesn't match the conventional commit format" src="https://github.com/user-attachments/assets/36054ab8-70cd-4741-9d18-e4970854b240" />
> 
> It goes green if the format is correct (obviously 😄 )
> <img width="924" alt="PR check that succeeds when the PR title matches the conventional commit format" src="https://github.com/user-attachments/assets/b90343fa-0532-4287-9eb1-c03985de04f5" />

### @mattr- — 0 reactions  
`—`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2637884236)

> https://github.com/jekyll/jekyll-test-gem-plugin/pull/8 has an example of the release-please workflow running. We *can* keep the existing `History.markdown` file, though it's format changes slightly.

### @ashmaroli — 0 reactions  
`—`  ·  [link](https://github.com/jekyll/jekyll/pull/9760#issuecomment-2640049445)

> > We _can_ keep the existing `History.markdown` file, though it's format changes slightly.
> 
> For documentation / record purposes, could you please list all the changes? (This will help refactoring / altering our rake task used to generate `docs/_docs/history.md` in a future pull request)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
