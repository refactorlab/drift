# ryanoasis/nerd-fonts #1691 — Switch to devicons/devicon

**[View PR on GitHub](https://github.com/ryanoasis/nerd-fonts/pull/1691)**

| | |
|---|---|
| **Author** | @Finii |
| **Status** | ✅ merged |
| **Opened** | 2024-08-25 |
| **Repo importance** | ★63,239 · 3,900 forks · score 82,744 |
| **Diff** | +1381 / −112 across 39 files |
| **Engagement** | 28 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @Finii — 3 reactions  
`👍 3`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2312629108)

> Here a visual of which icons got dropped upstream (i.e. were in Vorillaz but are not in Devicons/Devicon) marked with blue, and the existing icons updated to Devicons/Devicon.
> 
> ![image](https://github.com/user-attachments/assets/2188f020-a7a6-4531-81c5-6f99f08d5f29)
> 
> Dropped icons often are in another set, so the impact is not too bad (e.g. Dropbox, Hackernews, ...)
> The other dropped icons are presumably not important nowadays or dead. :crossed_fingers: 
> 
> All the vacant codepoints are now used to fill in new icons; so that we have no gaps and still all icons of Devicons v2.16.0:
> 
> Side by side:
> 
> ![image](https://github.com/user-attachments/assets/7eea56c6-67d5-4c50-b2a7-fcce75e4abb0)
> 
> And all:
> 
> ![image](https://github.com/user-attachments/assets/f16d7311-e82a-4d28-bac8-1b571b48b562)
> 
> Some `svg`s taken from Devicons/Devicon had a problem, that I fixed, and also added a non-wordmark `awk` icon that is used (Devicons has only wordmark icons for `awk`):
> 
> ![image](https://github.com/user-attachments/assets/2b2e03e9-1ddb-4660-a8da-0470cacda38f)
> 
> As I write this I already notice some more problems that I will fix and force-push away soon.
> 
> _Ping to @snailedlt, discussions if needed can be better done here_

### @Finii — 2 reactions  
`❤️ 1 · 🚀 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2330944585)

> Backport improved fixed icons from PRs in devicons/devicon; force push.

### @Finii — 2 reactions  
`👍 2`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2475023481)

> Updated topmost description, well, except for the new `nginx`cccccbnkbr icon, but I do not want to do the images again :grimacing:
> 
> Ready to roll now.

### @Finii — 1 reactions  
`👀 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2474310500)

> The scaling...
> 
> Mono is of course all maxed out in the 'cell'.
> Here an image of the `Nerd Font` variant. Some icons are a bit smaller, some are bigger, but mostly not by much.
> The main reason is that the new icons are much more consistent in size; while the old icons spanned from rather small to very big. Now everything is more or less lined up:
> 
> ![image](https://github.com/user-attachments/assets/af93afd4-a582-4c0e-8239-5072da3d20be)
> 
> _Left: old icons, right: updated icons_
> 
> Note how extraordinary big JS was before, while Ionic is rather small in comparison to all others.
> In the new font JS got smaller and Ionic bigger, so now they are comparably big.

### @Finii — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2474679101)

> Ah it's you @hasecilu (you changed your avatar), yes, will check. Try to get this bloody release out asap ;-) Well, at least working continuously on it.
> 
> A problem I have with modifying the icons here relative to upstream is of course ... it diverges then.
> 
> But I will look later and keep you updated :+1:
> 
> Icon additions is the next thing after this PR, the the fonts, then release :grimacing:

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1691#issuecomment-2308851742)

> Here a list of which icons will get an update. and which have been dropped in devicons (they have a `-`).
> There are 95 icons dropped and 103 have updates.
> 
> <details>
> 
> ```
> # old name                codepoint      new file
> bing_small                E700           -
> css_tricks                E701           - !
> git                       E702           git/git-plain.svg
> bitbucket                 E703           bitbucket/bitbucket-original.svg
> mysql                     E704           mysql/mysql-original.svg
> streamline                E705           -
> database                  E706           - !
> dropbox                   E707           - !
> github_alt                E708           -
> github_badge              E709           github/github-original.svg
> github                    E70A           -
> wordpress                 E70B           wordpress/wordpress-plain.svg
> visualstudio              E70C           visualstudio/visualstudio-plain.svg
> jekyll_small              E70D           jekyll/jekyll-plain.svg
> android                   E70E           android/android-plain.svg
> windows                   E70F           windows8/windows8-original.svg
> stackoverflow             E710           stackoverflow/stackoverflow-plain.svg
> apple                     E711           apple/apple-original.svg
> linux                     E712           linux/linux-plain.svg
> appstore                  E713           -
> ghost_small               E714           ghost/ghost-original.svg
> yahoo                     E715           -
> codepen                   E716           codepen/codepen-original.svg
> github_full … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
