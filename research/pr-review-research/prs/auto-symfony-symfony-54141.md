# symfony/symfony #54141 — [Messenger] Introduce `DeduplicateMiddleware`

**[View PR on GitHub](https://github.com/symfony/symfony/pull/54141)**

| | |
|---|---|
| **Author** | @VincentLanglet |
| **Status** | ✅ merged |
| **Opened** | 2024-03-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +225 / −17 across 8 files |
| **Engagement** | 15 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @VincentLanglet — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2138829728)

> Friendly ping @jderusse @ro0NL do you have time for new look ?

### @VincentLanglet — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2160416373)

> Hi, maybe would you have time to give me a feedback on this @nicolas-grekas ?

### @echantigny — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2166073005)

> I was looking for a way to avoid having duplicate messages in my queue and stumbled on this.  I really wish this feature can be implemented soon.

### @VincentLanglet — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2166228478)

> > I was looking for a way to avoid having duplicate messages in my queue and stumbled on this. I really wish this feature can be implemented soon.
> 
> I personnally use this implementation on my project and it works fine. You can duplicate it on your projet if needed until the merge.

### @echantigny — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2166244330)

> > > I was looking for a way to avoid having duplicate messages in my queue and stumbled on this. I really wish this feature can be implemented soon.
> > 
> > I personnally use this implementation on my project and it works fine. You can duplicate it on your projet if needed until the merge.
> 
> I might give that a try if nothing moves here.  Thanks

### @maidmaid — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54141#issuecomment-2413325049)

> I personally use a very similar implementation, except for the lock mechanism. When you deploy a new application version, you may want to flush the messages queue. In that case, you don't have any out-of-the-box solution to release also the associated locks, so new dispatched messages can be aborted by mistake because the locks are still here.
> 
> So, I personally moved from locks to cache (if the key cache is hit, the message isn't dispatched). Thus, I can use `cache:pool:clear` command to also flush the message locks while a deploy.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
