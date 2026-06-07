# ghostty-org/ghostty #6004 — gtk: add localization support, take 3

**[View PR on GitHub](https://github.com/ghostty-org/ghostty/pull/6004)**

| | |
|---|---|
| **Author** | @pluiedev |
| **Status** | ✅ merged |
| **Opened** | 2025-02-26 |
| **Repo importance** | ★55,978 · 2,849 forks · score 72,369 |
| **Diff** | +925 / −15 across 18 files |
| **Engagement** | 16 conversation · 38 inline review comments |

## Top review comments (ranked by reactions)

### @pluiedev — 2 reactions  
`👍 2`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2685675971)

> Well it is part of the build system (I've added a new top-level step to run it via `zig run update-translations`), just not part of the normal build process, because altering source files in the Zig build system without explicit user intervention is frowned upon.

### @kenvandine — 2 reactions  
`👍 2`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2689142614)

> > I've already added that though. Squash commits are a bit hard to follow :p
> 
> Ah, great!  Then should be good from a snap perspective. Thanks!

### @kenvandine — 1 reactions  
`👍 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2689087600)

> > Got it. However, I wonder if if'd work OOTB - I see that LC_ALL is forcibly set to C.UTF-8 and there's some forum threads that suggest more work would be needed for it to work. (e.g. https://forum.snapcraft.io/t/the-gettext-launch-launcher-fix-gettext-based-internationalization-in-the-snap-runtime/9111, https://forum.snapcraft.io/t/lack-of-compiled-locales-breaks-gettext-based-localisation/3758) Is this still accurate?
> 
> Your current branch fails to build the snap because it can't find msgfmt which is provided by the gettext package. We need it for build time. For strictly confined snaps following our best practices, you get gettext automatically at build time, but ghostty is a classic snap that is a bit more complex.

### @pluiedev — 0 reactions  
`—`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2685365418)

> 1. xgettext is usually run by developers as a standalone tool outside of the build system, therefore it's neither a build-time nor a runtime dependency. Its sole purpose is to generate/update the PO template, and once the template is there only `msgfmt` is required for the build process (which does .po -> .mo)
> 
> 2. On macOS there's two ways to go about it: either do it the "legacy" way of using `.strings` files that can be added to Xcode, or the "new" (Xcode 15+) way of using what's known as ["string catalogs"](https://developer.apple.com/documentation/xcode/localizing-and-varying-text-with-a-string-catalog) (`.xcstring`s), which are essentially JSON files with a fancy editing interface inside Xcode.
> 
> What I've gathered is that while string catalogs are definitely the recommended translation mechanism from Apple moving forward and are a lot more convenient to use for the macOS apprt (`Text`s in SwiftUI transparently use them), they're kind of a pain for thirdparty integrations. The gettext stack has native support for legacy `.strings` files and so we can unify translations for both apprts, while `.xcstrings` is completely foreign to it (or rather, any program that's not Xcode). I think it would be up to you and other macOS devs to decide which format we should use on the macOS side.

### @mitchellh — 0 reactions  
`—`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2685369726)

> > xgettext is usually run by developers as a standalone tool outside of the build system, therefore it's neither a build-time nor a runtime dependency.
> 
> Right, but we're only committing the po files to the repo, right?
> 
> So if I'm understanding properly, we should plan to run this prior to generating the source tarball so packagers do not need to do this.

### @pluiedev — 0 reactions  
`—`  ·  [link](https://github.com/ghostty-org/ghostty/pull/6004#issuecomment-2685433529)

> Yeah, my plan is to always update the PO template *whenever* strings are added, changed or removed in PRs, enforced via CI. That way the template is always accurate to the source files (which is already desirable since they include source locations) and translators always have an up-to-date picture of what strings need to be translated. Packagers don't need to do anything.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
