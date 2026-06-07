# JetBrains/kotlin #5720 — Introduce JKlib pipeline

**[View PR on GitHub](https://github.com/JetBrains/kotlin/pull/5720)**

| | |
|---|---|
| **Author** | @jDramaix |
| **Status** | ✅ merged |
| **Opened** | 2026-03-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +3591 / −94 across 256 files |
| **Engagement** | 26 conversation · 158 inline review comments |

## Top review comments (ranked by reactions)

### @zardilior — 1 reactions  
`👍 1`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4036818825)

> @ddolovov and @demiurg906 We have addressed all comments so far and squashed the commits into 2 as requested, let us know if anything is missing.
> 
> cc: @jDramaix

### @zardilior — 1 reactions  
`👍 1`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4043197519)

> @udalov we have addressed the requested changes let us know if there's anything else

### @zardilior — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4049623756)

> @CristianGM and @fzhinkin the changes you requested have been addressed, let us know if there's anything else that catches your eye

### @ghost — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4014642704)

> ### Code Owners
> 
> <table>
> <tr>
>     <th>Rule</th>
>     <th>Owners</th>
>     <th>Approval</th>
> </tr>
> <tr>
>     <td><code>/​.​space/​CODEOWNERS</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-build-infrastructure">kotlin-build-infrastructure</a></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>/​compiler/​cli/​</code>, <code>/​compiler/​test-​infrastructure-​utils.​common/​</code>, <code>/​compiler/​tests-​common-​new/​</code>, <code>/​core/​descriptors.​jvm/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-frontend">kotlin-frontend</a></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>**.​gradle.​kts</code>, <code>**.​gradle</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-build-infrastructure">kotlin-build-infrastructure</a>, <code>@sellmair</code></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>/​compiler/​ir/​backend.​jvm/​</code>, <code>/​compiler/​ir/​serialization.​jvm/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-jvm">kotlin-jvm</a></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>/​compiler/​ir/​serialization.​common/​</code>, <code>/​compiler/​util-​klib/​</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin-common-backend">kotlin-common-backend</a></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>*</code></td>
>     <td><a href="https://github.com/orgs/JetBrains/teams/kotlin">kotlin</a></td>
>     <td align="center">✅</td>
> </tr>
> <tr>
>     <td><code>/​compiler/​testData/​ir/​irText/​</c … *[truncated]*

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4039487922)

> Changes in the [corresponding Merge-Request](https://github.com/JetBrains/kotlin/pull/5720) can't be rebased onto master due to conflicts. Please rebase the corresponding changes manually and trigger Safe-Merge again.

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5720#issuecomment-4039488046)

> Error: Command failed with exit code 1: git rebase --autosquash master refs/pull/5720/head
> Rebasing (1/11)Rebasing (2/11)error: could not apply 7a34ec736e52... fixup! Added K2JKlibCompiler pipeline for J2CL
> Could not apply 7a34ec736e52... # fixup! Added K2JKlibCompiler pipeline for J2CL


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
