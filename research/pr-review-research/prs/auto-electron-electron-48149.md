# electron/electron #48149 — feat: add `copyVideoFrameAt` and `saveVideoFrameAs` methods on `webContents`

**[View PR on GitHub](https://github.com/electron/electron/pull/48149)**

| | |
|---|---|
| **Author** | @dodolalorc |
| **Status** | ✅ merged |
| **Opened** | 2025-08-22 |
| **Repo importance** | ★121,543 · 17,236 forks · score 195,486 |
| **Diff** | +150 / −0 across 6 files |
| **Engagement** | 36 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @dodolalorc — 2 reactions  
`🚀 1 · 👀 1`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3219091222)

> @nikwen Can you give me an AP, please? Thanks!

### @nikwen — 2 reactions  
`👀 1 · 😄 1`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3282814983)

> > It looks like this pull request touches one of our dependency or CI files, and per [our contribution policy](https://github.com/electron/electron/blob/main/CONTRIBUTING.md#dependencies-upgrades-policy) we do not accept these types of changes in PRs.
> 
> This looks like a flake to me. Not sure what's going on there.

### @dodolalorc — 2 reactions  
`👍 2`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3344771919)

> > We're seeing crashes in CI:
> > 
> > ```
> > [1716:0928/183528.604:ERROR:third_party\blink\renderer\core\html\media\html_media_element.cc:5045] SetError: {code=4, message="MEDIA_ELEMENT_ERROR: Format error"}
> > [9080:0928/183528.604:FATAL:base\task\sequence_manager\thread_controller.cc:653] DCHECK failed: !delta.is_negative(). -0.000605 s
> > Symbols not available. Dumping unresolved backtrace:
> > 	0x7ff6985ffeb5
> > 	0x7ff6986101dc
> > 	0x7ff69872a254
> > 	0x7ff69872a119
> > 	0x7ff69874a73a
> > 	0x7ff69874a06c
> > 	0x7ff698686e79
> > 	0x7ff698683da0
> > 	0x7ff6986845f9
> > 	0x7ff69868e926
> > 	0x7ff69868fb44
> > 	0x7ff69868ed4a
> > 	0x7ff6985e99cf
> > 	0x7ff6985e8237
> > 	0x7ff698690bcd
> > 	0x7ff6986d1e1c
> > 	0x7ff695ffb4d8
> > 	0x7ff695ffdd80
> > 	0x7ff695ff7095
> > 	0x7ff6920d5507
> > 	0x7ff6920d7d32
> > 	0x7ff6920d7827
> > 	0x7ff6920d17f4
> > 	0x7ff6920d18eb
> > 	0x7ff6918f15ee
> > 	0x7ff6a1022082
> > 	0x7ffb069be8d7
> > 	0x7ffb08408d9c
> > Crash keys:
> >   "total-discardable-memory-allocated" = "0"
> >   "ever_had_universal_access_exemption" = "true"
> >   "LocaleDataPakExists-found_attrs" = "32"
> >   "LocaleDataPakExists-found_path" = "D:\a\electron\electron\src\out\Default\locales\en-US.pak"
> >   "chrome-trace-id" = "<OMITTED>"
> >   "platform" = "win32"
> >   "process_type" = "browser"
> > 
> > ✗ Electron tests failed with code 0x80000003.
> > ```
> > 
> > I reran the tests but they crashed with the same message.
> 
> I'm not sure what happen on ci cause the test I added goes well on my mac. I'll try rebase from main first, then check if there’s a solution.

### @samuelmaddock — 2 reactions  
`👍 2`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3368536674)

> I managed to fix `MEDIA_ELEMENT_ERROR: Format error` with [9badbba](https://github.com/electron/electron/pull/48149/commits/9badbba2bcb1724298b320743afca9917f9b4da1), however, it still crashes on Windows. I'll try to download the CI build on Windows next week and see what's happening.
> 
> With [build-tools](https://github.com/electron/build-tools), you can run `e pr download-dist 48149 --platform=win32` to download the produced build.

### @nikwen — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3221949826)

> Ah, thanks for explaining! I'm not super familiar with this part of the code. I'll let someone else review it.

### @reitowo — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/48149#issuecomment-3277614641)

> You can rebase and squash all commits to ensure all signed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
