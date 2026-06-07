# WebKit/WebKit #51619 — [WTF] Make CStringView handle only null termination related methods and add some helpers for spans to StringCommon

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/51619)**

| | |
|---|---|
| **Author** | @calvaris |
| **Status** | ✅ merged |
| **Opened** | 2025-10-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +616 / −159 across 34 files |
| **Engagement** | 36 conversation · 177 inline review comments |

## Top review comments (ranked by reactions)

### @darinadler — 1 reactions  
`👍 1`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3460462730)

> > we don't have a String constructor for `span<char8_t>`
> 
> We should add that constructor. I am working on a set of pull requests to get rid of all the `String::fromUTF8`.

### @calvaris — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3462511248)

> I added an operator to create `span<char8_t>` from literals to ease certain comparisons.

### @webkit-early-warning-system — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3355835052)

> EWS run on previous version of this PR (hash https://github.com/WebKit/WebKit/commit/ff723fbb5787f09430abf89540ea03566d4c8133)<details>
> 
> | Misc | iOS, visionOS, tvOS & watchOS  | macOS  | Linux |  Windows |
> | ----- | ---------------------- | ------- |  ----- |  --------- |
> | [✅ 🧪 style](https://ews-build.webkit.org/#/builders/38/builds/123971 "Passed style check") | [✅ 🛠 ios](https://ews-build.webkit.org/#/builders/131/builds/43686 "Built successfully") | [✅ 🛠 mac](https://ews-build.webkit.org/#/builders/138/builds/34383 "Built successfully") | [✅ 🛠 wpe](https://ews-build.webkit.org/#/builders/5/builds/130787 "Built successfully") | [✅ 🛠 win](https://ews-build.webkit.org/#/builders/59/builds/76123 "Built successfully") 
> | [✅ 🧪 bindings](https://ews-build.webkit.org/#/builders/9/builds/125848 "Passed tests") | [✅ 🛠 ios-sim](https://ews-build.webkit.org/#/builders/130/builds/44410 "Built successfully") | [✅ 🛠 mac-AS-debug](https://ews-build.webkit.org/#/builders/123/builds/52280 "Built successfully") | [❌ 🧪 wpe-wk2](https://ews-build.webkit.org/#/builders/34/builds/94300 "Failure limit exceed. At least found 130 new test failures: accessibility/accessibility-node-memory-management.html accessibility/accessibility-node-reparent.html accessibility/accessibility-object-detached.html accessibility/accessibility-object-update-during-style-resolution-crash.html accessibility/activation-of-input-field-inside-other-element.html accessibility/active-descendant-changes-result-in-focus-changes.html accessibility/add-children-pseudo-element.html accessibility/adjacent-continuati … *[truncated]*

### @calvaris — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3359911111)

> > I agree with Chris. At first glance, this doesn’t seem like a good idea. Perhaps a use case would change my mind. I’m not sure.
> 
> Some use cases. Sometimes we read environment variables and wrap them CStringView or we invoke `gstStructureGetString(structure, "needed-field"_s)` that returns a CStringView.
> 
> 1. Read env var and compare it to "true" or "1". operator== does the job nice and easy.
> 2. Read and env var but you want to compare ignoring case to enable "True" or "True". `WTF::equalLettersIgnoringASCIICase(quirks.unsafeAsASCIIStringView(), "true"_s)` would be handy.
> 3. You read a codec name from a string that can be "avc", "AVC" or whatever combination and you want to keep that value lowercase to ease further comparisons: `auto codecName = gstStructureGetString(structure, "needed-field"_s).unsafeAsStringView().convertToASCIIUppercase()`. I could avoid converting to a String first and save a check and memcopy because I know it is going to be ASCII.
> 4. You have a string and you want to parse it: `auto value = parseIntegerAllowingTrailingJunk<int64_t>(minPTime.unsafeToASCIIStringView())`
> 5. You need to check if certain string begins with something: `fieldName.unsafeToASCIIStringView().startsWith("extmap-"_s)`. Or ends. Or contains.
> 6. You are using makeString(cStringView.unsafeToASCIIStringView(), '-', nextId++).
> 7. You want to split a CStringView in pieces separated by , .
> 
> Examples of this are at https://github.com/WebKit/WebKit/pull/51259 . That did not land yet because @philn , with good criteria, thought that we could be regressing in perf even when increasing in co … *[truncated]*

### @geoffreygaren — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3363389251)

> > 1. Read env var and compare it to "true" or "1". operator== does the job nice and easy.
> > 2. Read and env var but you want to compare ignoring case to enable "True" or "True". `WTF::equalLettersIgnoringASCIICase(quirks.unsafeAsASCIIStringView(), "true"_s)` would be handy.
> 
> Is getenv() guaranteed to return ASCII? I don’t think it is. 
> 
> I think this is how we ended up with ASCIILiteral as our optimization for ASCII: it is pretty rare for an API that returns an arbitrary string to guarantee that the string will be ASCII. But when we have a literal, we can sometimes guarantee it.

### @calvaris — 0 reactions  
`—`  ·  [link](https://github.com/WebKit/WebKit/pull/51619#issuecomment-3364308834)

> > > 1. Read env var and compare it to "true" or "1". operator== does the job nice and easy.
> > > 2. Read and env var but you want to compare ignoring case to enable "True" or "True". `WTF::equalLettersIgnoringASCIICase(quirks.unsafeAsASCIIStringView(), "true"_s)` would be handy.
> > 
> > Is getenv() guaranteed to return ASCII? I don’t think it is.
> 
> The issue here is not if environment variables can be or not UTF8, which they can. The issue is the use to do with them. If you're planning to parse an integer out of them then it does not matter because we are already checking if the characters are ASCII digits and if not, it will fail. Same for comparisons, unless I am missing anything, "watermelon🍉" begins with ASCII "watermelon". I am not saying you don't have to convert an env variable whose content you're going to use as is.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
