# JetBrains/kotlin #5875 — [Wasm] Replace first stage test config with phased CLI infra (^KT-74671)

**[View PR on GitHub](https://github.com/JetBrains/kotlin/pull/5875)**

| | |
|---|---|
| **Author** | @jmrtsh |
| **Status** | ✅ merged |
| **Opened** | 2026-04-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +194 / −426 across 33 files |
| **Engagement** | 73 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @vsukharev — 1 reactions  
`👍 1`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4326902660)

> > this is never read anywhere (according to the IDE),
> Yes, I found, where is was missed, and have a patch for you. Will PM it to you

### @ghost — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4258565310)

> ### Code Owners
> 
> <table><tr><th>Rule</th><th>Owners</th><th>Approval</th></tr><tr><td><code>/​compiler/​cli/​cli-​js/​</code></td><td><details><summary><a href="https://github.com/orgs/JetBrains/teams/kotlin-js">kotlin-js</a></summary><ul><li><a href="https://github.com/JSMonk"><b><code>@JSMonk</code></b></a></li><li><a href="https://github.com/broadwaylamb"><b><code>@broadwaylamb</code></b></a></li><li><a href="https://github.com/seclerp"><b><code>@seclerp</code></b></a></li><li><a href="https://github.com/AnzhelaSukhanova"><b><code>@AnzhelaSukhanova</code></b></a></li></ul></details><details><summary><a href="https://github.com/orgs/JetBrains/teams/kotlin-wasm">kotlin-wasm</a></summary><ul><li><a href="https://github.com/bashor"><b><code>@bashor</code></b></a></li><li><a href="https://github.com/karlosz"><b><code>@karlosz</code></b></a></li><li><a href="https://github.com/ilgonmic"><b><code>@ilgonmic</code></b></a></li><li><a href="https://github.com/jmrtsh"><b><code>@jmrtsh</code></b></a></li><li><a href="https://github.com/igoriakovlev"><b><code>@igoriakovlev</code></b></a></li><li><a href="https://github.com/agamzikova"><b><code>@agamzikova</code></b></a></li><li><a href="https://github.com/alex28sh"><b><code>@alex28sh</code></b></a></li><li><a href="https://github.com/ozzush"><b><code>@ozzush</code></b></a></li></ul></details></td><td align="center">✅<br><a href="https://github.com/broadwaylamb"><b><code>@broadwaylamb</code></b></a> 🔒, <a href="https://github.com/alex28sh"><b><code>@alex28sh</code></b></a></td></tr><tr><td><code>/​compiler/​ir/​serialization.​common/ … *[truncated]*

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4258588382)

> **THIS IS A DRY RUN**
> 
> Quality gate is triggered at https://buildserver.labs.intellij.net/build/927616181 — use this link to get full insight.
> 
> Quality gate was triggered with the following revisions:
> > **kotlin**
> > Branch: `refs/merge/GITHUB-5875/safe-merge`
> > Commit: [26f282a](https://github.com/JetBrains/kotlin/commit/26f282a4f3362ae942afaad687a3f5102b055511)

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4261588931)

> **THIS IS A DRY RUN**
> 
> Quality gate is triggered at https://buildserver.labs.intellij.net/build/928051934 — use this link to get full insight.
> 
> Quality gate was triggered with the following revisions:
> > **kotlin**
> > Branch: `refs/merge/GITHUB-5875/safe-merge`
> > Commit: [b28909a](https://github.com/JetBrains/kotlin/commit/b28909a055388c6bb7c72bfee3edb926c2979129)

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4262992716)

> Triggered a [retry attempt](https://buildserver.labs.intellij.net/build/928223454) №1 out of 1.

### @KotlinBuild — 0 reactions  
`—`  ·  [link](https://github.com/JetBrains/kotlin/pull/5875#issuecomment-4263785168)

> Quality gate failed. See https://buildserver.labs.intellij.net/build/928051934 to get full insight.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
