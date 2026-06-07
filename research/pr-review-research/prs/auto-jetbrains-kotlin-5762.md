# JetBrains/kotlin #5762 — [Build] Introduce 'Test Federation'

**[View PR on GitHub](https://github.com/JetBrains/kotlin/pull/5762)**

| | |
|---|---|
| **Author** | @sellmair |
| **Status** | ✅ merged |
| **Opened** | 2026-03-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +2310 / −10 across 69 files |
| **Engagement** | 12 conversation · 149 inline review comments |

## Top review comments (ranked by reactions)

### @sellmair — 1 reactions  
`👍 1`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4161997228)

> > The scope is completely unclear to me. What am I expected to review exactly? Is the annotating supposed to be exhaustive? Or does this PR just add some non-systematic examples of how the tests can be marked?
> 
> Everyone is invited to provide general feedback on the system. However, the set of annotations is meant to be a 'starting point.' Teams are free to mark up their tests/test suites as they see fit. At some agreed-upon time in the future, we would like to engage the system in our first experiments. Any reviewer, therefore, is only required to review owned code, according to the codeowners.

### @ghost — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4099523348)

> ### Code Owners
> 
> <table>
> <tr>
>     <th>Rule</th>
>     <th>Owners</th>
>     <th>Approval</th>
> </tr>
> <tr>
>     <td><code>.​gitignore</code>, <code>**.​gradle.​kts</code>, <code>/​gradle/​</code>, <code>/​repo/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-build-infrastructure">kotlin-build-infrastructure</a>, <code>@sellmair</code></td>
>     <td align="center">✅<br><code>@goodwinnk</code></td>
> </tr>
> <tr>
>     <td><code>/​analysis/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-analysis-api">kotlin-analysis-api</a></td>
>     <td align="center">✅<br><code>@yanex</code></td>
> </tr>
> <tr>
>     <td><code>/​libraries/​tools/​kotlin-​gradle-​plugin-​integration-​tests/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-build-tools">kotlin-build-tools</a></td>
>     <td align="center">✅<br><code>@Tapchicoma</code></td>
> </tr>
> <tr>
>     <td><code>/​native/​swift/​**/​*.​gradle.​kts</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-native">kotlin-native</a></td>
>     <td align="center">✅<br><code>@mMaxy</code>, <code>@SvyatoslavScherbina</code></td>
> </tr>
> <tr>
>     <td><code>/​native/​swift/​</code></td>
>     <td><code>@glukianets</code>, <code>@mMaxy</code></td>
>     <td align="center">✅<br><code>@mMaxy</code></td>
> </tr>
> <tr>
>     <td><code>/​plugins/​compose/​</code></td>
>     <td><code>@ShikaSD</code>, <code>@andrewbailey</code>, <code>@bentrengrove</code>, <code>@chuckjaz</code>, <code>@derekxu16</code></td>
>     <td align="center">✅<br><code>@ShikaSD</code></td>
> </tr>
> <tr>
>     <td><code>/​s … *[truncated]*

### @sellmair — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4169096647)

> Note: The naming of the 'contract' annotations was changed to `@AffectedByXYZ` 
> `JsContract` -> `AffectedByJs`

### @sellmair — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4197845965)

> @Tapchicoma Unfortunately, the review bot removed your approval after a rebase. The issue is known and will be fixed soon, but this MR would requrie re-approval from your side.

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4204702482)

> Quality gate is triggered at https://buildserver.labs.intellij.net/build/921265295 — use this link to get full insight.
> 
> Quality gate was triggered with the following revisions:
> > **kotlin**
> > Branch: `refs/merge/GITHUB-5762/safe-merge`
> > Commit: [57f483a](https://github.com/JetBrains/kotlin/commit/57f483a95c07258da91eb666328bc7f3feb0ab84)

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5762#issuecomment-4204853384)

> Triggered a [retry attempt](https://buildserver.labs.intellij.net/build/921292127) #1 out of 1.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
