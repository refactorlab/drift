# pi-hole/pi-hole #5785 — Install dependencies by creating a meta package on-the-fly

**[View PR on GitHub](https://github.com/pi-hole/pi-hole/pull/5785)**

| | |
|---|---|
| **Author** | @yubiuser |
| **Status** | ✅ merged |
| **Opened** | 2024-09-29 |
| **Repo importance** | ★59,134 · 3,215 forks · score 76,939 |
| **Diff** | +200 / −230 across 15 files |
| **Engagement** | 29 conversation · 9 inline review comments |

## Top review comments (ranked by reactions)

### @yubiuser — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2451939394)

> > Do you have a link to the documentation you followed? 
> 
> Don't remember exactly, some top search results, and for sure https://www.internalpointers.com/post/build-binary-deb-package-practical-guide. I tried it locally and on ubuntu/fedora containers and tweaked it until it worked as expected.

### @PromoFaux — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2540907432)

> Have run this several times from fresh install - works well - the uninstall process is a lot smoother, and appears to do a much better job of things than the existing process.
> 
> Still need to test  it from v5 -> this branch before I approve, just to make sure

### @rdwebdesign — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2381441402)

> The install process (before this PR) was:
> 
> 1. install OS dependent packages (`OS_CHECK_DEPS[@]`);
> 2. Check if installed OS is officially supported;
> 3. Install packages used by the installation script (`INSTALLER_DEPS[@]`).
> 
> Your proposed code is installing all packages (steps 1 and 3) **before** checking if the OS is supported (step 2).
> 
> Do you think this will cause issues?

### @yubiuser — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2381444060)

> Note: this PR is still WIP, I need to finish the uninstaller, add comments and wanted to add a TRAP.
> But in principal you're correct, first thing I do is to install all dependencies. But I think this is legit. Users decided to install Pi-hole in the first place, so I think it's OK to install the dependencies. If the stop at the OS check, they can still proceed with the env variable set. If they don't want, the TRAP is going to print hat some deps might have been installed, and they should remove the Pi-hole metapackage followed by an `autoremove`.
> The benefit is a much cleaner installer and uninstaller.
> 
> **Add**
> 
> I think it is not feasible to have 3 meta-packages: one for the OS check, one for the installer and one for Pi-hole itself.

### @rdwebdesign — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2381446193)

> > I think it is not feasible to have 3 meta-packages
> 
> I agree.

### @rdwebdesign — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5785#issuecomment-2381462776)

> I'm not sure if `newt` is needed anymore. 
> 
> It was a dependency for `whiptail`, but I don't think it is used with `dialog` (I'm unable to test in Fedora/CentOS right now).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
