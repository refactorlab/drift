# WebKit/WebKit #48322 — Implement speculation rules - same origin conservative prefetch

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/48322)**

| | |
|---|---|
| **Author** | @yoavweiss |
| **Status** | ✅ merged |
| **Opened** | 2025-07-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +1677 / −299 across 179 files |
| **Engagement** | 78 conversation · 133 inline review comments |

## Top review comments (ranked by reactions)

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3096693388)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/71ece0bca548e0389c25be9fba0cd1c44cffe407)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/112536 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32268 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/22746 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/118734 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/62989 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/114498 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/32920 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/40831 "Built successfully") | [  ~~🧪 wpe-wk2~~](https://ews-build.webkit.org/#/builders/34/builds/85655 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [❌ 🧪 win-tests](https://ews-build.webkit.org/#/builders/60/builds/36266 "") 
> | [✅ 🧪 webkitperl](https://ews-build.webkit.org/#/builders/11/builds/115483 "Passed tests") | [❌ 🧪 ios-wk2](https://ews-build.webkit.org/#/builders/132/builds/26270 "Found 60 new test failures: compositing/fixed-position-scroll-offset-history-restore.html editing/pasteboard/drop-text-events-sideeffect.html editi … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3097577940)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/2540373e853a7412c2c996650eb43ea4d4462f96)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/112564 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32296 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/22774 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/118763 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/63021 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/114526 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/32948 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/40859 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/85688 "Found 272 new test failures: accessibility/w3c-svg-description-calculation.html accessibility/w3c-svg-name-calculation.html compositing/fixed-position-scroll-offset-history-restore.html fast/backgrounds/size/contain-and-cover-zoomed.html fast/backgrounds/size/contain-and-cover.html fast/dom/Element/getElementsByTagNameNS-nullable.html fast/dom/HTMLHeadElement/head-check.html fast/dom/NodeIterator/NodeIterator-leak-document.html fast/dom/TreeWalker/TreeWalker-leak-document.html fast/events/backspace- … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3100278743)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/755430ec21a953daf080bf1bb6fb541a1191d677)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/112656 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32388 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/22866 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/118855 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/63134 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/114618 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/33040 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/40951 "Built successfully") | [  ~~🧪 wpe-wk2~~](https://ews-build.webkit.org/#/builders/34/builds/85734 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") | [  ~~🧪 win-tests~~](https://ews-build.webkit.org/#/builders/60/builds/36362 "The change is no longer eligible for processing. Commit was outdated when EWS attempted to process it.") 
> | [✅ 🧪 webkitperl](https://ews-build.webkit.org/#/builders/11/builds/115603 "Passed tests") | [❌ 🧪 ios-wk2](https://ews-build.webkit.org/#/builders/132/builds/26363 "Found 60 new test failures: accessibility … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3100687866)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/b8b7acb0e4785670d5be3c89e4b37cae50eaada7)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/112661 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32393 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/22871 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/118860 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/63154 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/114623 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/33045 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/40956 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/85744 "Found 148 new test failures: compositing/fixed-position-scroll-offset-history-restore.html fast/dom/HTMLHeadElement/head-check.html fast/dom/NodeIterator/NodeIterator-leak-document.html fast/dom/TreeWalker/TreeWalker-leak-document.html fast/dom/navigation-type-back-forward.html fast/events/backspace-navigates-back.html fast/events/pageshow-pagehide-on-back-uncached.html fast/frames/crash-when-child-iframe-forces-layout-during-unload-and-sibling-frame-has-mediaquery.html fast/frames/iframe-option-cra … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3102293215)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/05727b8518fbd7ed083c4ff65918133a171fac20)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/112680 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32412 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/22890 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/118879 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/63169 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/114642 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/33064 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/40975 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/85757 "Found 149 new test failures: compositing/fixed-position-scroll-offset-history-restore.html fast/dom/HTMLHeadElement/head-check.html fast/dom/NodeIterator/NodeIterator-leak-document.html fast/dom/TreeWalker/TreeWalker-leak-document.html fast/dom/navigation-type-back-forward.html fast/events/backspace-navigates-back.html fast/events/pageshow-pagehide-on-back-uncached.html fast/frames/crash-when-child-iframe-forces-layout-during-unload-and-sibling-frame-has-mediaquery.html fast/frames/iframe-option-cra … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/48322#issuecomment-3118670091)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/3de25c844003ff059b437014d7b4e6c6f140fa8e)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/113171 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/32906 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/23384 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/119379 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/64261 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/115133 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/33558 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/41469 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/86152 "Found 154 new test failures: compositing/fixed-position-scroll-offset-history-restore.html fast/dom/HTMLHeadElement/head-check.html fast/dom/NodeIterator/NodeIterator-leak-document.html fast/dom/TreeWalker/TreeWalker-leak-document.html fast/dom/navigation-type-back-forward.html fast/events/backspace-navigates-back.html fast/events/pageshow-pagehide-on-back-uncached.html fast/frames/crash-when-child-iframe-forces-layout-during-unload-and-sibling-frame-has-mediaquery.html fast/frames/iframe-option-cra … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
