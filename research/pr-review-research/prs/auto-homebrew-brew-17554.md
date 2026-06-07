# Homebrew/brew #17554 — Add cask install receipts

**[View PR on GitHub](https://github.com/Homebrew/brew/pull/17554)**

| | |
|---|---|
| **Author** | @Rylan12 |
| **Status** | ✅ merged |
| **Opened** | 2024-06-23 |
| **Repo importance** | ★48,317 · 11,150 forks · score 97,901 |
| **Diff** | +1146 / −218 across 26 files |
| **Engagement** | 20 conversation · 55 inline review comments |

## Top review comments (ranked by reactions)

### @Bo98 — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2185452209)

> Do you have an example what the tab of a cask with an uninstall DSL looks like?
> 
> Idea being we avoid reading the Ruby file entirely when uninstalling, except for flight blocks which the tab should have a boolean or something that indicates those are used.

### @MikeMcQuaid — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2185891745)

> > * Storing the tap that a cask was installed from.
> > * Storing the cask version.
> 
> In both of these cases: we should store the same for formulae and in the same format for both (to make parsing either easier).
> 
> > Idea being we avoid reading the Ruby file entirely when uninstalling, except for flight blocks which the tab should have a boolean or something that indicates those are used.
> 
> My understanding is also we hope to be able to eventually deprecate these flight blocks so that only the tab is needed for uninstall.

### @Bo98 — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2205946393)

> > The pre/post flight blocks do show up in the artifact lists (just as null), but we could generate it using artifacts_list compact: true to ignore those blocks if we want.
> > 
> > 
> 
> This is fine. We needed something to to determine whether flight blocks are used on uninstall so this works. We'll use this later to only load the Ruby file when needed on uninstall.
> 
> `caskfile_only` also checks non-uninstall flight blocks which wouldn't be useful for our case.

### @apainintheneck — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2219554284)

> The approach to getting the recursive deps for each cask looks good to me.
> 
> I'm with you when you say that the arch and macos info maybe shouldn't be included in the runtime dependencies section. We already have `arch` at the top-level of the install receipt and os version is already included in the `built_on` section. It's not obvious to me that either of the arch or os dependencies are needed in the install receipt.

### @MikeMcQuaid — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2226551395)

> Looks great, thanks @Rylan12! Let's merge this tomorrow when we're all together in case there's any issues.

### @Rylan12 — 0 reactions  
`—`  ·  [link](https://github.com/Homebrew/brew/pull/17554#issuecomment-2185496679)

> > Do you have an example what the tab of a cask with an uninstall DSL looks like?
> 
> Here is the tab for `slack`:
> 
> ```json
> {
>   "homebrew_version": "4.3.6-71-ge30aea5-dirty",
>   "loaded_from_api": true,
>   "installed_as_dependency": false,
>   "installed_on_request": true,
>   "time": 1719197835,
>   "dependencies": {
>     "macos": {
>       ">=": [
>         "10.15"
>       ]
>     }
>   },
>   "arch": "arm64",
>   "source": {
>     "path": "",
>     "tap": "homebrew/cask",
>     "tap_git_head": "f755fc333ebe7647fa3988e360d47a82120db032",
>     "version": "4.39.88"
>   },
>   "installed_on": {
>     "os": "Macintosh",
>     "os_version": "macOS 14",
>     "cpu_family": "arm_firestorm_icestorm",
>     "xcode": "15.4",
>     "clt": "15.3.0.0.1.1708646388",
>     "preferred_perl": "5.34"
>   },
>   "artifacts": [
>     {
>       "uninstall": [
>         {
>           "quit": "com.tinyspeck.slackmacgap"
>         }
>       ]
>     },
>     {
>       "app": [
>         "Slack.app"
>       ]
>     },
>     {
>       "zap": [
>         {
>           "trash": [
>             "~/Library/Application Scripts/com.tinyspeck.slackmacgap",
>             "~/Library/Application Support/com.apple.sharedfilelist/com.apple.LSSharedFileList.ApplicationRecentDocuments/com.tinyspeck.slackmacgap.sfl*",
>             "~/Library/Application Support/Slack",
>             "~/Library/Caches/com.tinyspeck.slackmacgap*",
>             "~/Library/Containers/com.tinyspeck.slackmacgap*",
>             "~/Library/Cookies/com.tinyspeck.slackmacgap.binarycookies",
>             "~/Library/Group Containers/*.com.tinyspeck.slackmacgap",
>             "~/Library/Group Containers/*.slack",
>             "~/Library/ … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
