# WebKit/WebKit #50706 — Add support for loading USDs in WCP and rendering them in GPUP

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/50706)**

| | |
|---|---|
| **Author** | @mwyrzykowski |
| **Status** | ✅ merged |
| **Opened** | 2025-09-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +5324 / −28 across 98 files |
| **Engagement** | 99 conversation · 150 inline review comments |

## Top review comments (ranked by reactions)

### @rr-codes — 1 reactions  
`👍 1`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288791587)

> Will take a look at this on Monday, (please don’t merge before then, thanks!)

### @rr-codes — 1 reactions  
`👍 1`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288792928)

> also, please try splitting up this PR as much as possible please

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288726403)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/ae61980c82007ed2f2edfa4d74c6ea56e909b15b)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [❌ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/120773 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/40467 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/31120 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/127175 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/72849 "Failed to checkout and rebase branch from PR 50706") | ⏳ 🛠 ios-apple 
> | [❌ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/122649 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/41165 "Failed to checkout and rebase branch from PR 50706") | [❌ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/49044 "Failed to checkout and rebase branch from PR 50706") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/5/builds/127175 "Failed to checkout and rebase branch from PR 50706") | [❌ 🧪 win-tests](https://ews-build.webkit.org/#/builders/59/builds/72849 "Failed to checkout and rebase branch from PR 50706") | ⏳ 🛠 mac-apple … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288734347)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/4b02f750718d67d342893c50aa502378956ee689)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/120775 "Passed style check") | [❌ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/40469 "Hash 4b02f750 for PR 50706 does not build (failure)") | [  ~~🛠 mac~~](https://ews-build.webkit.org/#/builders/138/builds/31122 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [❌ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/127177 "Hash 4b02f750 for PR 50706 does not build (failure)") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/72851 "Hash 4b02f750 for PR 50706 does not build (failure)") | [❌ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/92699e7b-e2c4-41dd-8b79-0fc7c00d5b52/b8afd5c9-b720-4205-8ce7-f777a5222c0d) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/122651 "Passed tests") | [❌ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/41167 "Hash 4b02f750 for PR 50706 does not build (failure)") | [❌ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/49046 "Hash 4b02f750 for PR 50706 does not build (failure)") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/5/builds/127177 "Hash 4b02f750 for PR 50706 does not build (failure)") | [❌ 🧪 win-tests](https: … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288740236)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/e35696ca70d795776c2b5d06b61dcb05c16858e0)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/120776 "Passed style check") | [❌ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/40470 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/31123 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/127178 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/72852 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/92699e7b-e2c4-41dd-8b79-0fc7c00d5b52/423d5a78-5569-43f0-b1d5-64420b0325fd) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/122652 "Passed tests") | [❌ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/41168 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/49047 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/5/builds/127178 "Hash e35696ca for PR 50706 does not build (failure)") | [❌ 🧪 win-tests](https://ews-build.webkit.org/#/builders/59/builds/72852 "Hash … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/50706#issuecomment-3288894005)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/636ccdcd9751430d68b67ef07fe3bb37d2a43e89)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/120792 "Passed style check") | [❌ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/40486 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/31141 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/127198 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/72868 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/92699e7b-e2c4-41dd-8b79-0fc7c00d5b52/fa6f854d-3eaa-48fe-99d1-63a6f8b1dfd5) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/122668 "Passed tests") | [❌ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/41184 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/49063 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/5/builds/127198 "Hash 636ccdcd for PR 50706 does not build (failure)") | [❌ 🧪 win-tests](https://ews-build.webkit.org/#/builders/59/builds/72868 "Hash … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
