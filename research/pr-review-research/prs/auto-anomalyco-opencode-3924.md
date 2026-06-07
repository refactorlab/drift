# anomalyco/opencode #3924 — feat: nix support for the nix folks

**[View PR on GitHub](https://github.com/anomalyco/opencode/pull/3924)**

| | |
|---|---|
| **Author** | @Alb-O |
| **Status** | ✅ merged |
| **Opened** | 2025-11-04 |
| **Repo importance** | ★170,163 · 20,357 forks · score 256,590 |
| **Diff** | +869 / −8 across 15 files |
| **Engagement** | 36 conversation · 5 inline review comments |

## Top review comments (ranked by reactions)

### @Alb-O — 8 reactions  
`❤️ 4 · 🎉 4`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3530155973)

> Hash inconsistency issues seem to be finally resolved, pinpointing the issue to symlinked binaries in `node_modules/.bun` and `.bin`, and normalizing these paths during nix builds. Looking nice and stable now 🤞

### @Alb-O — 4 reactions  
`🎉 3 · 🚀 1`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3489475027)

> Oh boy it was fun trying to get the node modules perfectly reproducible with Bun’s symlink tree, think I found a way though, it builds in github CI and on my local machine now. Next up is support for darwin builds and configuring the workflow automation

### @Alb-O — 3 reactions  
`👍 2 · ❤️ 1`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3575385220)

> Yes, you can simply fetch/patch release tarballs. But this flake is targeted mainly for contributor usage where building and running the dev work tree which doesn't have a release yet is a must. It also helps out the nixpkgs maintainers who prefer packages to be built from source (and cached)

### @Alb-O — 2 reactions  
`🚀 2`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3500986807)

> > yields a different hash.
> 
> Thank you for testing, these tiny, tiny, differences between the GitHub runner environment and actual user hardware that results in a different hash is driving me a bit mental, but I'll look into it nonetheless. I had it working well on linux x86_64 (exact same hashes between runner and my machine), so maybe an OS/darwin issue? Would be good to know if linux builds are working consistently
> 
> Edit: I just realized you meant there was a hash difference between the two different commands which really should give the exact same result. Hm this is a good clue

### @delafthi — 2 reactions  
`👍 2`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3503594734)

> I encountered this exact issue when I first packaged OpenCode for nixpkgs. The problem stems from fetching from a link which doesn't pin a specific version - whenever `api.json` gets updated on the server, you'll get a hash mismatch. In other words, the output of that `fetchContent` isn't consistent.
> 
> I solved this by packaging `models-dev` separately (see the [package definition](https://github.com/NixOS/nixpkgs/blob/nixos-unstable/pkgs/by-name/mo/models-dev/package.nix)) and then using that as a dependency.

### @delafthi — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/anomalyco/opencode/pull/3924#issuecomment-3506556962)

> Tested the current version. Success, both `x86_64-darwin` and `aarch64-darwin` worked.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
