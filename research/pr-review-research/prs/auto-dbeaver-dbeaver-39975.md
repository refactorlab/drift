# dbeaver/dbeaver #39975 — dbeaver/dbeaver#35880 Add catalog support for StarRocks

**[View PR on GitHub](https://github.com/dbeaver/dbeaver/pull/39975)**

| | |
|---|---|
| **Author** | @chris-celerdata |
| **Status** | ✅ merged |
| **Opened** | 2025-12-19 |
| **Repo importance** | ★50,422 · 4,222 forks · score 72,300 |
| **Diff** | +2096 / −29 across 29 files |
| **Engagement** | 23 conversation · 42 inline review comments |

## Top review comments (ranked by reactions)

### @carc-connor-moore — 3 reactions  
`👍 3`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-4217090628)

> hi @Matvey16 any chance you can take a look? Lot of people in the community (and our team) is really excited about this one.

### @arhayka — 1 reactions  
`😄 1`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-3711457783)

> @chris-celerdata Thank you for the contribution! I’ve passed this PR to the development team for review.

### @ShadelessFox — 1 reactions  
`👍 1`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-4031509285)

> Hi @chris-celerdata,
> 
> > Is there anything else needed for this PR
> 
> It currently awaits testing :^)

### @chris-celerdata — 1 reactions  
`👀 1`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-4337251008)

> @DariaMarkaryan Sorry about that, the merge caused that compilation error. It should be fixed now.

### @chris-celerdata — 1 reactions  
`👀 1`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-4338702091)

> This is expected behavior. The top level folders were from the MySQL tree structure and this plugin uses the generic tree structure. 
> 
> Some of those folders (Users, Session/Global Status) were either broken or unused. However, Session Variables and Global Variables were functional and are now missing. Re-implementing this is non-trivial so a follow-up may be better. For example, users in StarRocks are queried differently than MySQL and requires custom parsing and tree injection (for generic).

### @Destrolaric — 0 reactions  
`—`  ·  [link](https://github.com/dbeaver/dbeaver/pull/39975#issuecomment-3789640536)

> Thanks for the changes. I am going to invite the second reviewer. It might take some time. Thank you the changes.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
