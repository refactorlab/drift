# jesseduffield/lazygit #4826 — feat(nix): add comprehensive Nix flake

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/4826)**

| | |
|---|---|
| **Author** | @doprz |
| **Status** | ✅ merged |
| **Opened** | 2025-08-15 |
| **Repo importance** | ★78,963 · 2,860 forks · score 95,391 |
| **Diff** | +357 / −5 across 7 files |
| **Engagement** | 23 conversation · 49 inline review comments |

## Top review comments (ranked by reactions)

### @Eveeifyeve — 2 reactions  
`👍 2`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3258089360)

> > A few things.
> > 
> >     * The branch is totally unreviewable with all the merges from master, and all the fine-grained commits that change things back and forth. I rebased onto master to get rid of the merge commits and force-pushed, this makes it a little bit reviewable at least. In the end I suppose all commits need to be squashed into one. We don't do this by default here, it's the contributor's job to provide a commit sequence that makes sense. In the future, please look into working with `fixup!` commits, and never merge master into your branch; always rebase onto master instead.
> > 
> >     * As for maintaining it here vs. elsewhere: your explanation above still didn't make it very clear to me what the benefit is of maintaining the flake in this repo vs. somewhere else. I now saw that we have an issue for this (#3474), this explains it a little bit better. But still, there are also things like flakehub, would it be an option to use that instead?
> > 
> > 
> > The reason why I'm still hesitant to host the flake here is that this PR has shown that it needs expertise to get this right. @Eveeifyeve seems to have done a great job at helping with this, but if they are not around next time we need to make a change to this, who else will be able to do that? I won't, because I totally lack the expertise, and I don't intend to acquire it. @Eveeifyeve What's your take on this?
> 
> I agree to most of this this pr is at the point where you need to squash the commits. Second Maintaining the flake should be left up to the nix contributors and not the main program maintainers it should be in th … *[truncated]*

### @doprz — 1 reactions  
`👍 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3239591492)

> Thank you for your feedback @Eveeifyeve on this PR! It's been very helpful to learn best practices.

### @doprz — 1 reactions  
`👍 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3258921715)

> This configuration is at the point where it should not require any major changes or foreseeable maintenance to it. The main purpose of this PR was to allow nix users to have a development shell with all of the required deps and tools to start developing and using `lazygit`. I've also added the ability to build with nix as a nice bonus. I've also squashed the commits + updated the docs as requested.
> 
> The original commit I made worked albeit not using best practices as I wasn't aware of things such as `flake-compat` to offer backwards compatibility to non-flake users. A good example of a project offering nix configuration with a dev environment is [ghostty](https://github.com/ghostty-org/ghostty). I'm easily able to clone the repository and have a working zig environment that is reproducible.
> 
> <img width="515" height="156" alt="image" src="https://github.com/user-attachments/assets/670e2313-607e-4cff-9ee1-4d012b099bc7" />
> 
> The PR is not about replacing the "unofficial" nix flake or adding distribution/package management files to the lazygit repo. It's about allowing nix users to have a declarative and reproducible dev environment to allow them to contribute to lazygit. All they have to do is cd into the repo and load up the dev shell or build lazygit via nix or with make. It's a quality of life PR at it's core.

### @stefanhaller — 1 reactions  
`👍 1`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3381443291)

> Since everything seems addressed now, I'm going to merge this. Thanks again @doprz for the contribution, and @Eveeifyeve for the reviews.

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3194443425)

> I know next to nothing about Nix, and in particular I don't know what Nix flakes are. I don't really want to spend time on learning more about that, either. However, I would have to understand things a little better in order to judge if the PR is good and can be merged. So what can we do?
> 
> I see that our current README.md already says something about flakes ([here](https://github.com/jesseduffield/lazygit/blob/011ff853b8620ee684652a29bb9edeb6311328ea/README.md?plain=1#L384)), but I don't understand what it means. Would this have to be changed with your PR?
> 
> Any people reading here who are more familiar with Nix and can help review this?

### @doprz — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4826#issuecomment-3201388444)

> It seems that someone has already uploaded `lazygit` to nixpkgs which is what your current README.md references.
> https://search.nixos.org/packages?channel=25.05&show=lazygit&query=lazygit
> 
> I will update the README.md to include information about the local nix flake. In summary this will allow people that use nix to run your project in an ephemeral shell, install it, and even have a fully setup dev env with go and other dependencies managed by nix. 
> 
> This will be an official flake that is fully featured while the one on nixpkgs is maintained by others and will either follow the 20.05 or unstable channel.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
