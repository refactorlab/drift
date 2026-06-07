# ChrisTitusTech/winutil #4023 — Add-WPFTweaksRevertStartMenu

**[View PR on GitHub](https://github.com/ChrisTitusTech/winutil/pull/4023)**

| | |
|---|---|
| **Author** | @ghost |
| **Status** | ✅ merged |
| **Opened** | 2026-02-10 |
| **Repo importance** | ★55,540 · 3,145 forks · score 73,117 |
| **Diff** | +75 / −0 across 2 files |
| **Engagement** | 24 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @ghost — 2 reactions  
`👍 1 · 👎 1`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3880977266)

> > I still think it makes more sense to do it this way, even if it gets fewer updates.
> 
> well i dont

### @ghost — 1 reactions  
`👎 1`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3881234520)

> > @GabiNun u done it again lol the link should be z--Advanced-Tweaks---CAUTION instead off essential-tweaks. dont let this happen again lol Jokes.
> 
> oh

### @erffy — 0 reactions  
`—`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3880951898)

> ```ps1
> # Get the latest release data from GitHub API
> $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/thebookisclosed/ViVe/releases/latest"
> 
> # Find the download URL for the 'IntelAmd' zip file (ignoring the ARM64 version)
> $downloadUrl = $latestRelease.assets | Where-Object { $_.name -like "*IntelAmd.zip" } | Select-Object -ExpandProperty browser_download_url
> ```
> 
> You can use this method to download the latest version and the correct zip file without hardcoding the version or disrupting the flow.

### @ghost — 0 reactions  
`—`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3880958854)

> > ```powershell
> > # Get the latest release data from GitHub API
> > $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/thebookisclosed/ViVe/releases/latest"
> > 
> > # Find the download URL for the 'IntelAmd' zip file (ignoring the ARM64 version)
> > $downloadUrl = $latestRelease.assets | Where-Object { $_.name -like "*IntelAmd.zip" } | Select-Object -ExpandProperty browser_download_url
> > ```
> > 
> > You can use this method to download the latest version and the correct zip file without hardcoding the version or disrupting the flow.
> 
> ye but its unneccary since that version well take years to change

### @erffy — 0 reactions  
`—`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3880964360)

> I still think it makes more sense to do it this way, even if it gets fewer updates.

### @seanh1995 — 0 reactions  
`—`  ·  [link](https://github.com/ChrisTitusTech/winutil/pull/4023#issuecomment-3881222421)

> @GabiNun u done it again lol the link should be z--Advanced-Tweaks---CAUTION instead off essential-tweaks. dont let this happen again lol Jokes.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
