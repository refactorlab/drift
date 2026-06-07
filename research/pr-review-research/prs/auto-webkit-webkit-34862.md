# WebKit/WebKit #34862 — [TextureMapper] Preserve-3d layers don't get flattened correctly

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/34862)**

| | |
|---|---|
| **Author** | @zhani |
| **Status** | ✅ merged |
| **Opened** | 2024-10-08 |
| **Repo** | curated review-culture seed |
| **Diff** | +271 / −30 across 4 files |
| **Engagement** | 29 conversation · 161 inline review comments |

## Top review comments (ranked by reactions)

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2400808747)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/b0dfbb1afaaa67289faa6484713a158b9700a91c)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/70727 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/48/builds/50137 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/55/builds/23496 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/74820 "Built successfully") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/21926 "Hash b0dfbb1a for PR 34862 does not build (failure)") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/72843 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/49/builds/57935 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/61/builds/21748 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/56005 "Found 34 new test failures: compositing/overlap-blending/opacity-and-infinity.html fast/harness/snapshot-captures-compositing.html imported/w3c/web-platform-tests/css/css-transforms/backface-visibility-hidden-002.html imported/w3c/web-platform-tests/css/css-transforms/backface-visibility-hidden-child-translate.html imported/w3c/web-platform-tests/css/css-transforms/change-perspective-property.html imported/w3c/web-platform-tests/css/css-transforms/composited-under-rotateY-1 … *[truncated]*

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2401291649)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/7921efd7dc1dff5590b22b5a4b8d65a34f0b70f3)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/70797 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/48/builds/50207 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/55/builds/23566 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/74894 "Built successfully") | [❌ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/21997 "Hash 7921efd7 for PR 34862 does not build (failure)") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/72913 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/49/builds/58005 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/61/builds/21818 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/56034 "Found 34 new test failures: compositing/overlap-blending/opacity-and-infinity.html fast/harness/snapshot-captures-compositing.html imported/w3c/web-platform-tests/css/css-transforms/backface-visibility-hidden-002.html imported/w3c/web-platform-tests/css/css-transforms/backface-visibility-hidden-child-translate.html imported/w3c/web-platform-tests/css/css-transforms/change-perspective-property.html imported/w3c/web-platform-tests/css/css-transforms/composited-under-rotateY-1 … *[truncated]*

### @zhani — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2401293972)

> This patch also fixes:
> https://bugs.webkit.org/show_bug.cgi?id=281113
> https://bugs.webkit.org/show_bug.cgi?id=241016

### @zhani — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2401295833)

> > Thanks @zhani! Looking forward to get this fixed.
> > 
> > Phew, I have a hard time understanding this patch, but I would like to :-) I hope you can improve the commit message, to me it's quite unclear _how_ you are fixing things, and _what_ the current problems are. Ideally with more examples, what is going wrong. Even better with the smallest possible testcase, that you then dissect.
> 
> There's a simplified test case attached to  bug description and also quote from CSS spec for correct behavior. Added the CSS spec quote to commit message to clarify the purpose. Should I create more small test cases in addition to what's attached to bug description?
> 
> In above comment I added couple of links to other bugs which this patch fixes. Those have more test case desciptions

### @zhani — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2401305627)

> > It's inefficient to allocate TextureMapperFlattenedLayer for all flattened layers in `preprocess`.
> > 
> > In my WIP patch https://bugs.webkit.org/show_bug.cgi?id=241699#c5 TextureMapperLayer::paint2DRoot allocates a temporary texture only for the current 2D layer.
> 
> Hi @fujii, I did notice your WIP patch but it hasn’t seen activity for a while, so I decided to start from scratch as there were also other bugs related to the same issue. Starting fresh helped me gain a clearer understanding of what’s going wrong.
> 
> Your point about allocating temporary textures is valid—it’s definitely more efficient to allocate them only for the layer currently being processed. My original idea was to create clearer stages in the painting process to better track what’s happening. I’ll update my patch so that it only allocates temporary textures for the layer being painted, in line with your suggestion.
> 
> I will be a bit slow to respond this week due to being on vacation, but I should have an updated patch ready by next week.
> 
> Do you think it would be better to continue with your WIP patch, or should we move forward with the new approach?

### @fujii — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/34862#issuecomment-2401445214)

> I think my approach is better. But, it's an old patch and I can't remember what are remaining problems.
> However, EWS reported a lot of regresions for your patch. I'm not sure which is better way to take.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
