# browser-use/browser-use #857 — Add anti bot detection via patchright

**[View PR on GitHub](https://github.com/browser-use/browser-use/pull/857)**

| | |
|---|---|
| **Author** | @neo773 |
| **Status** | ✅ merged |
| **Opened** | 2025-02-24 |
| **Repo importance** | ★97,305 · 10,878 forks · score 145,766 |
| **Diff** | +38 / −57 across 11 files |
| **Engagement** | 46 conversation · 5 inline review comments |

## Top review comments (ranked by reactions)

### @neo773 — 8 reactions  
`👍 5 · ❤️ 3`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2771053505)

> Hi,
> 
> Sorry it took this long I've been very occupied, spent the day revisiting this PR. 
> I pushed a new commit that resolves this.
> 
> So a summary of what happened: 
> 
> - Rebrowser patch was likely broken as it failed the tests with super minimal reproduction code.
> - Patchright seems to be working great
> - CSP wasn't being persisted in `BrowserContext` which prevented a lot of websites behind Cloudflare and other DDoS protection services
> - Also removed Shadow DOM init script it kept triggering Cloudflare anti-bot, If I am not wrong Patchright seems to be handling that part
> 
> CreepJS scored 53%
> 
> https://github.com/user-attachments/assets/34b27f89-e978-45f6-9965-c9f39a7e049d
> 
> But the biggest win is Cloudflare protected sites work now, you can try it with a sample site dexscreener.com
> 
> https://github.com/user-attachments/assets/50e2ed80-d54a-4c18-bf5e-73d5820aa6bd
> 
> cc
> @gregpr07 @nwebson

### @stevelizcano — 3 reactions  
`👍 2 · 👀 1`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2819983781)

> > I tried to install it from the main branch and got this error:
> > 
> > ```
> > Resolved 241 packages in 1.56s
> >    Updating https://github.com/browser-use/browser-use (main)
> >   × Failed to download and build `browser-use @ git+https://github.com/browser-use/browser-use@ae3bfadc0b7d58c928393e0df58d43da3b8fe5a0`
> >   ├─▶ Git operation failed
> >   ╰─▶ process didn't exit successfully: `/opt/homebrew/bin/git reset --hard ae3bfadc0b7d58c928393e0df58d43da3b8fe5a0` (exit status: 128)
> >       --- stderr
> >       Downloading static/kayak.gif (3.5 MB)
> >       Error downloading object: static/kayak.gif (ab32dca): Smudge error: Error downloading static/kayak.gif (ab32dca74aff21e80c1d05457e61204216fd50109c6c8bdd158de4231c3cdaf0): error transferring
> >       "ab32dca74aff21e80c1d05457e61204216fd50109c6c8bdd158de4231c3cdaf0": [0] remote missing object ab32dca74aff21e80c1d05457e61204216fd50109c6c8bdd158de4231c3cdaf0
> > 
> >       Errors logged to '/Users/trevor.sullivan/.cache/uv/git-v0/checkouts/6fb0cbb493015030/ae3bfad/.git/lfs/logs/20250421T112508.868766.log'.
> >       Use `git lfs logs last` to view the log.
> >       error: external filter 'git-lfs filter-process' failed
> >       fatal: static/kayak.gif: smudge filter lfs failed
> > 
> >   help: If you want to add the package regardless of the failed resolution, provide the `--frozen` flag to skip locking and syncing.
> > ```
> 
> This is what you want to do, that works for me:
> 
> ```sh
> GIT_LFS_SKIP_SMUDGE=1 uv add git+https://github.com/browser-use/browser-use.git@main --upgrade
> ```

### @gregpr07 — 2 reactions  
`👍 2`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2683037777)

> @neo773 no actually cross site iFrames are really really important use case. Websites like Salesforce and other “legacy” providers that are extremely valuable need them. I can’t merge this - we absolutely need cross site iframe support!
> 
> @gaurav-cointab i guess not all websites will be fixed, but we will be one step closer with rebrowser (if it works)

### @Vinyzu — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2770550961)

> @pirate Hi! Author of Patchright here... (so biased opinion ofcourse)
> 
> In comparison to rebrowser patchright is:
> - More Actively Developed (Recent Rebrowser Update is 4 months old, still on v1.49.1, Patchright is on v1.51.1 (most recent version))
> - More Feature-Rich, for example Patchright is now able to [access Closed Shadow Roots](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/issues/28#issuecomment-2737129193) using normal locators.
> - More Robust (According to Issues less Bugs, Patchright was also tested against Playwright Tests and Bugs are [properly documented](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/issues/30) ) (Not that currently there some issues/bugs in patchright because of the new Locator and Init Script Engine but im working on it actively, shouldnt take long to fix)
> - More Stealthy (Patchright patches more leaks and is reported to me to have better pass rates, though i also heard from few that rebrowser worked better for them in that regard)
> - Has a Robust CD, thanks to automatic Workflow Releasing and a better Patch handling with AST-based Patching instead of .Patch Files

### @Vinyzu — 2 reactions  
`❤️ 1 · 🚀 1`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2771807279)

> Also please not merge until this [fix](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/issues/58) (which concerns XPaths) is pushed to prod (ill notify you).
> 
> I also spent a few more hours yesterday and i have some promising attempts to get XPaths in Closed Shadow Roots working.

### @Vinyzu — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/browser-use/browser-use/pull/857#issuecomment-2781627242)

> I understand your point/problem and it would likely be possible to implement something like this, but it does go against the goal patchright is trying to achieve.
> 
> Patchrights/My most important goal is to provide a stealthy playwright version, not to be the "Dream Automation Library" that implements every useful functionality.
> Furthermore my time is quite limited, i support many other OSS Projects that would need some attention right now, and i planned on working on them from now on. A functionality like you described is not easy or quick to implement.
> 
> TL;DR: It would be possible, but hard and i dont have the time nor the motivation nor the ambition to implement this. But after all, contributions to my projects are always welcome...


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
