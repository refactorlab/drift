# Genymobile/scrcpy #5370 — Add virtual display feature

**[View PR on GitHub](https://github.com/Genymobile/scrcpy/pull/5370)**

| | |
|---|---|
| **Author** | @rom1v |
| **Status** | ✅ merged |
| **Opened** | 2024-10-12 |
| **Repo importance** | ★143,036 · 13,192 forks · score 200,707 |
| **Diff** | +1207 / −330 across 37 files |
| **Engagement** | 48 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @Laurie-Lin — 5 reactions  
`👍 5`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2411152853)

> Thank you for your contribution.
> 
> Test platform: Mac(M2)/Meizu 21
> 
> Test way:
> ```bash
> git fetch origin pull/5370/head:pr-5370
> git checkout pr-5370
> meson setup x --buildtype=release --strip -Db_lto=true
> ninja -Cx  # DO NOT RUN AS ROOT
> ./run x --new-display=1920x1080
> ```
> 
> I mainly tested the following scenarios:
> 
> - Without using the --new-display option, using scrcpy --display xxx to render the virtual display screen, the click events work normally.
> - Using scrcpy --new-display=1920x1080, the created virtual display can be clicked normally.
> 
> Due to this flag
> 
> ```bash
> VIRTUAL_DISPLAY_FLAG_SHOULD_SHOW_SYSTEM_DECORATIONS
> ```
> 
> On the Meizu device I tested, the Launcher will start on this virtual display. This is not an issue, but rather an unexpected benefit.
> 
> Here is a screenshot.
> 
> <img width="1816" alt="截屏2024-10-14 20 49 52" src="https://github.com/user-attachments/assets/54875a24-19ee-4640-ad09-8cc8057dd4dd">
> 
> By the way, I have ported scrcpy to Android.
> 
> Once I complete the remaining work, I invite you to experience this software. Thank you very much.

### @vaddisrinivas — 3 reactions  
`👍 1 · ❤️ 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2408624648)

> tested this on mac(m1pro) - works!
> 
> Steps I followed - 
> - clone and switch to branch
> - install dependencies
> - build 
> - install 
> - tested for -[this issue](https://github.com/Genymobile/scrcpy/issues/4598)

### @rom1v — 3 reactions  
`👍 1 · 🚀 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2499796803)

> @Xtr126 The work I did to implement virtual display i based on previous work, as mentioned in the post:
> 
> > Then, based on the discussions in https://github.com/Genymobile/scrcpy/issues/1887 and the work by @yume-chan and @anirudhb
> 
> In particular, the prototype by @anirudhb attempted to support resizing: https://github.com/anirudhb/scrcpy/commits/virtual-display/
> 
> But there is more work need it to make it work properly (and this brings new problems to solve), and virtual displays was already a lot of work, so I preferred implementing a non-resizable version first. Making it resizable could be done in the future.

### @4nric — 2 reactions  
`👍 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2413384218)

> > Additionally, on some devices, the launcher displays incorrectly on non-default screens.
> 
> Launcher I tested that works: Lawnchair ([playstore](https://play.google.com/store/apps/details?id=app.lawnchair.play), [github](https://github.com/LawnchairLauncher/lawnchair)). Another instance of the launcher can be opened on secondary displays without additional flags. Good enough for quickly launching apps for now
> 
> ```
> scrcpy --new-display
> ```
> ```
> adb shell am start -n app.lawnchair.play/app.lawnchair.LawnchairLauncher --display 12
> ```
> https://github.com/user-attachments/assets/85058b48-8086-43ab-99e9-cfd41efbfcd4

### @rom1v — 2 reactions  
`👍 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2424864307)

> @eiyooooo OK.
> 
> > [Commit that granted Shell the ADD_TRUSTED_DISPLAY permission](https://android.googlesource.com/platform/frameworks/base/+/990e3429636382175ca8e7bf04df054f48fbd130)
> 
> Indeed, it has been merged in Android 13:
> 
> ```bash
> # in aosp/framework_base
> git tag --contains 990e3429636382175ca8e7bf04df054f48fbd130
> ```
> 
> I first added readable Android version constants (already merged into `dev`): 3acffaae57238ee47e05f97f8e762a04550fdad8 (the Android way to select a version was a mess, I had to check the mapping every time).
> 
> Then I set the TRUSTED and other flags only since Android 13: e05be0ba17a1a48275eef19d92f1c729b35a0c6d

### @rom1v — 2 reactions  
`👍 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5370#issuecomment-2442206150)

> @Withoutruless I removed the restriction for UHID/AOA mouse.
> 
> Let's merge this. :rocket: 
> 
> I think this feature will deserve a new major version (3.0). Maybe next week or the week after, I have others changes to make beforehand. (EDIT: a bit more time to include #5455)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
