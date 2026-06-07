# WebKit/WebKit #57827 — [JSC] Rewrite module loader

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/57827)**

| | |
|---|---|
| **Author** | @heimskr |
| **Status** | ✅ merged |
| **Opened** | 2026-02-04 |
| **Repo** | curated review-culture seed |
| **Diff** | +4599 / −1314 across 87 files |
| **Engagement** | 154 conversation · 77 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @heimskr — 7 reactions  
`❤️ 7`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3849128923)

> I've written [a fuzzer](https://gist.github.com/heimskr/2718b749af45f16753fd64aa74de22a0) to produce convoluted dependency graphs to test the module loader rewrite. So far, every test I've run has produced identical output when run with this PR vs. when run with NodeJS, whereas running the tests with JSC prior to this PR will produce incorrect output and (in debug builds) the occasional assertion failure.

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3844807280)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/027dc02bf09cf1988b1a21c8e6c4101f9c09b273)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/142235 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/159/builds/14631 "Built successfully") | [  ~~🛠 mac~~](https://ews-build.webkit.org/#/builders/168/builds/5159 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/150866 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/95411 "Built successfully") | [✅ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/9e3e4f99-fedf-4da3-8a91-4b42e965e839/502b37b9-5adf-4058-bbeb-1609e54108a0) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/144102 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/155/builds/15350 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/156/builds/14784 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/109359 "Failure limit exceed. At least found 489 new test failures: http/tests/misc/module-absolute-url.html http/tests/security/contentSecurityPolicy/1.1/import-scriptnonce.html http/tests/security/contentSecurityPolicy/1.1/module-scriptnonce-allowed. … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3849073723)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/c6ed35a569cd2f8c66f5dec3110521e7365ad74a)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/142368 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/159/builds/14764 "Built successfully") | [  ~~🛠 mac~~](https://ews-build.webkit.org/#/builders/168/builds/5212 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/151014 "Built successfully") | [  ~~🛠 win~~](https://ews-build.webkit.org/#/builders/59/builds/95553 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [❌ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/9e3e4f99-fedf-4da3-8a91-4b42e965e839/324f4cc4-e5bf-4295-b343-f2c05e6eea80) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/144235 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/155/builds/15483 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/156/builds/14918 "Built successfully") | [  ~~🧪 wpe-wk2~~](https://ews-build.webkit.org/#/builders/34/builds/109484 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [  ~~🧪 win-tests~~](https://ews-build.webkit … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3849707297)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/cef57c9191bf7a40ec91502c2d007409de3e8cdd)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/142409 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/159/builds/14805 "Built successfully") | [  ~~🛠 mac~~](https://ews-build.webkit.org/#/builders/168/builds/5300 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/151057 "Built successfully") | [  ~~🛠 win~~](https://ews-build.webkit.org/#/builders/59/builds/95596 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [![loading](https://user-images.githubusercontent.com/3098702/171232313-daa606f1-8fd6-4b0f-a20b-2cb93c43d19b.png) 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/9e3e4f99-fedf-4da3-8a91-4b42e965e839/490af4d5-190f-48ff-97c4-df1e014d3d0a) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/144276 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/155/builds/15524 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/156/builds/14959 "Built successfully") | [  ~~🧪 wpe-wk2~~](https://ews-build.webkit.org/#/builders/34/builds/109511 "The change is no longer eligible for proc … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3850507392)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/fc59918d72a1e6f5b6effcb56775a516e185ab64)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/142480 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/159/builds/14946 "Built successfully") | [⏳ 🛠 mac ](https://ews-build.webkit.org/#/builders/macOS-Sequoia-Release-Build-EWS "Waiting in queue, processing has not started yet") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/151136 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/95667 "Built successfully") | [❌ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/9e3e4f99-fedf-4da3-8a91-4b42e965e839/c68b19c7-4a2e-4211-8b90-b0a239902296) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/144347 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/155/builds/15607 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/156/builds/15030 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/109569 "Found 421 new test failures: compositing/toggle-compositing.html http/tests/misc/module-absolute-url.html http/tests/security/contentSecurityPolicy/1.1/import-scriptnonce.html http/tests/security/contentSecurityPolicy/1.1/module-scriptnonce-allowed.html http/tests/security/contentSecu … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/57827#issuecomment-3855794751)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/baf444ba8e4999a558035de07825c17cb477d474)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows | Apple Internal |
> | ----- | ---------------------- | ------- |  ----- |  --------- | ------ |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/142692 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/159/builds/15164 "Built successfully") | [  ~~🛠 mac~~](https://ews-build.webkit.org/#/builders/168/builds/5697 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/151366 "Built successfully") | [  ~~🛠 win~~](https://ews-build.webkit.org/#/builders/59/builds/95881 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [✅ 🛠 ios-apple](https://ews-bridge.webkit.apple.com/builds/sw/T-276/9e3e4f99-fedf-4da3-8a91-4b42e965e839/68b22a21-dbc5-4925-b706-87a5ca1353df) 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/144559 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/155/builds/15820 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/156/builds/15245 "Built successfully") | [  ~~🧪 wpe-wk2~~](https://ews-build.webkit.org/#/builders/34/builds/109744 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [  ~~🧪 win-tests~~](https://ews-build.webkit … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
