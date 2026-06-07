# nektos/act #2265 — Support overwriting caches

**[View PR on GitHub](https://github.com/nektos/act/pull/2265)**

| | |
|---|---|
| **Author** | @wolfogre |
| **Status** | ✅ merged |
| **Opened** | 2024-03-28 |
| **Repo importance** | ★70,754 · 1,948 forks · score 83,484 |
| **Diff** | +239 / −118 across 3 files |
| **Engagement** | 23 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @ChristopherHX — 1 reactions  
`👍 1`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2024582537)

> > Upload the cache dir with the same key to replace the old cache
> 
> Yes this is probably true in act, since the run_number, run_id, run_attempt doesn't update automatically.
> 
> I'm not yet shure that this is the same Key on GitHub Actions Servers, but they could have silently implemented the override cache feature request.
> 
> For act it's fine for me to merge...
> 
> >  FAIL: TestRunEvent/networking
> 
> Should we remove that flaky test? I mean it caused a lot of reruns in the past

### @wolfogre — 0 reactions  
`—`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2024561013)

> Weird, I don't think the failed CI is related now.
> 
> <img width="1517" alt="image" src="https://github.com/nektos/act/assets/9418365/b49efa82-9305-430c-bf48-350511e86d23">

### @wolfogre — 0 reactions  
`—`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2024647444)

> > > FAIL: TestRunEvent/networking
> > 
> > Should we remove that flaky test? I mean it caused a lot of reruns in the past
> 
> @ChristopherHX Thank you for pointing out the problem. I was lost in the huge logs.
> 
> How about #2266?
> 
> I have tested the commit in this PR, and it works, but I will revert it since it is unrelated.

### @wolfogre — 0 reactions  
`—`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2024667232)

> > > Upload the cache dir with the same key to replace the old cache
> > 
> > Yes this is probably true in act, since the run_number, run_id, run_attempt doesn't update automatically.
> > 
> > I'm not yet shure that this is the same Key on GitHub Actions Servers, but they could have silently implemented the override cache feature request.
> > 
> 
> @ChristopherHX I am sure GitHub Actions support multiple caches with the same key.
> 
> Let me show you the [cache manage page](https://github.com/go-gitea/gitea/actions/caches) of the Gitea repo.
> 
> <img width="1291" alt="image" src="https://github.com/nektos/act/assets/9418365/e03d00d1-a501-4f39-87be-c5e7b9167742">

### @ChristopherHX — 0 reactions  
`—`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2025013998)

> > @ChristopherHX I am sure GitHub Actions support multiple caches with the same key
> 
> Ah yes that are cache scopes that are not implemented here.
> 
> They are unique per repo + ref only default branch scope

### @wolfogre — 0 reactions  
`—`  ·  [link](https://github.com/nektos/act/pull/2265#issuecomment-2025085206)

> > > @ChristopherHX I am sure GitHub Actions support multiple caches with the same key
> > 
> > Ah yes that are cache scopes that are not implemented here.
> > 
> > They are unique per repo + ref only default branch scope
> 
> Actually I have already implemented the cache scope, maybe port it later after this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
