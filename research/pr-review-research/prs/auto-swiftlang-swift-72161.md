# swiftlang/swift #72161 — [android] add a module map for Android NDK

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/72161)**

| | |
|---|---|
| **Author** | @hyp |
| **Status** | ✅ merged |
| **Opened** | 2024-03-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +869 / −0 across 3 files |
| **Engagement** | 89 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @finagolfin — 2 reactions  
`👍 2`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-2121750581)

> > I am ready to do Termux testing this week, so would appreciate any pointers or patches that you think I need.
> 
> Best if you hold off for a bit, as there was a regression in C++ interop a couple months ago when building the trunk Swift compiler in Termux with a prebuilt Swift compiler that uses the `Glibc` overlay. I'm going to try cross-compiling a recent trunk toolchain with your new `Android` overlay instead next and see if that fixes it, though it may not.
> 
> Once I know how that turns out, I'll let you know how best to build trunk Swift on Termux.
> 
> > Do you think we can move towards getting this merged in the meantime? I would like to land this sooner than later to have better chance of us landing in Swift 6 as well as we're time constrained there.
> 
> We're getting there, now that there are no more regressions in the non-Termux tests when building an Android SDK, but I think we should test it on some Swift packages first. For example, I intend to apply your Android overlay patches to [my daily Android CI](https://github.com/finagolfin/swift-android-sdk#swift-cross-compilation-sdk-for-android) this week, then patch those Swift packages for your new overlay and cross-compile and run all their tests on the Android emulator.
> 
> You can do the same testing with various Swift packages, since you're able to cross-compile an Android SDK with your Android overlay pulls.
> 
> I'm building the March 1 trunk source snapshot of SwiftPM natively in Termux right now with your overlay pulls, after which I will run its tests.
> 
> I think we can get these pulls tested well this week and clean them u … *[truncated]*

### @finagolfin — 2 reactions  
`👍 2`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-2124769766)

> > Thanks, let's plan to finalize everything for these PRs this week
> 
> I doubt that will happen. Let's try to get this right, there is no deadline here.
> 
> > and will update this PR with the 'zlib' change too.
> 
> Great, let me know when that's ready, so I can redo some testing with that change.
> 
> > Yes, Swift 6 doesn't ship for a few more month but it will be really hard to convince the project owners that this change should land in Swift 6 as the time passes, as they will ultimately be in charge of deciding whether this will be ok to get cherry-picked into Swift 6 or not, and they have a high bar for changes as time gets closer to the release.
> 
> I know, having had such backport pulls refused in the past, but my understanding is that bar is lower for unofficial platforms like Android, understandably so.
> 
> Let's just try to get it in when we are confident it's working well, which you can ascertain by building several packages with these patches and running their tests on Android, ie you can put more effort into testing to speed that up if you want. Of course, if you plan to take June off for summer vacation or something, that would be good to know ahead of time. 😉
> 
> I'm happy to report that the SwiftPM and Swift Syntax packages have no test regressions out of their thousands of tests each, when built natively in Termux with a March 1 trunk snapshot toolchain with your pulls applied.
> 
> Next, I will try building a May trunk snapshot compiler with that modified March trunk snapshot toolchain, both natively in the Termux app for Android and by cross-compiling it from linux. Finally, I wil … *[truncated]*

### @finagolfin — 2 reactions  
`👍 2`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-2147255521)

> I now have these stdlib and foundation pulls running against trunk on my Android CI, finagolfin/swift-android-sdk#151, with all those Swift packages' tests passing on the Android x86_64 emulator once I got them ported over to use your new overlay. Any further iterations on these overlay pulls should be easy to check by simply updating that CI pull and running my Android CI again.
> 
> Now that this new `SwiftAndroid` module includes all the same headers as the old `SwiftGlibc` module plus some extra Android headers, it is a drop-in replacement for `Glibc`, simply requiring an `import Android` and not much else.
> 
> I'll leave final approval up to @ian-twilightcoder, as I know little about these module maps compared to him, but I don't have any objections to this current version, since it works well when building for Android and fixes C++ Interop tests that had been failing with NDK 26.

### @hyp — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-1999903275)

> > > What kind of issues did you see with NDK 26?
> > 
> > The [same error I mentioned to you more than a year ago](https://github.com/apple/swift/pull/62052#issuecomment-1314105803), except dozens of C++ Interop executable tests that passed with NDK 25 now fail to compile with that `mbstate_t` error with NDK 26. I know the issue is something related to NDK 26 because I natively built a late November trunk source snapshot tag of the Swift toolchain twice in the Termux app: the exact same source built once with NDK 25c then with NDK 26b.
> 
> I see. That error should go away with the updated module map, since I am able to successfully build and import the uchar module from the NDK now.

### @hyp — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-2000170937)

> The sysroot flag is being worked on here - https://github.com/apple/swift/pull/72352 . I removed the sysroot detection from this PR .

### @finagolfin — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/72161#issuecomment-2005957368)

> > I thought there was a recent discussion thread about Libc module on the forums, but I couldn't find (there's also this one from 2016
> 
> You may be thinking of [this more recent pitch thread from a couple years ago](https://forums.swift.org/t/pitch-the-cstdlib-module/51373), that didn't end up going anywhere.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
