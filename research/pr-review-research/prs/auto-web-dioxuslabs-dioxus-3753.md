# DioxusLabs/dioxus #3753 — feat: windows app icon

**[View PR on GitHub](https://github.com/DioxusLabs/dioxus/pull/3753)**

| | |
|---|---|
| **Author** | @Klemen2 |
| **Status** | Merged (April 22, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jkelleyrtp
> I'm just not a fan of the winres approach... I would prefer we use sui to embed the icon for windows instead of the build.rs / winres system... I just don't want icon configuration to be done from within the build.rs.

### @Klemen2
> winres was already doing compilation of the icon in the cli and was not using any cargo / build script since the first working version of this PR.

### @jkelleyrtp
> dx bundle shells out to wix / nsi which have options to include icons. For many users this could just be enough? You don't get icons during dev, but you do in bundle, which is really what matters.

### @Klemen2
> wix / nsi settings only add icon to the installer, not the actual app. the pr is basically doing cargo rustc -- -C link-arg=app.res where res needs to be compiled with rc.exe.

### @pythoneer
> Anything left i can help with to bring this over the finish line? 0.7 is nearing its release and i would love to not use a workaround for my current releases with 0.6 to have app icons.

### @Klemen2
> windows is very bad at updating app icons of installed apps, so if you bundle the app, install it, change the icon and bundle again and reinstall - it will look buggy.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
