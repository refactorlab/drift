# go-gitea/gitea #37119 — Introduce `ActionRunAttempt` to represent each execution of a run

**[View PR on GitHub](https://github.com/go-gitea/gitea/pull/37119)**

| | |
|---|---|
| **Author** | @Zettat123 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-06 |
| **Repo importance** | ★56,132 · 6,774 forks · score 88,227 |
| **Diff** | +3802 / −812 across 74 files |
| **Engagement** | 86 conversation · 65 inline review comments |

## Top review comments (ranked by reactions)

### @silverwind — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4201974688)

> 1. Would order buttons like `[attempt] [re-run all]`. People are use to buttons being at the same places.
> 2. Hide the button on first attempt, only show on subsequent ones (maybe that's already the case).

### @Zettat123 — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4240588180)

> > Actually ignore last suggestion. I think translators will not understand that they can re-order fields with our cryptic golang placeholders. We can keep the "by" solution I guess. Maybe replace it with a `by %s` keyed `by_user`.
> 
> Replaced with `by %s` in fce65d112cd7a703ebdfacbf8b7b51e0d711f4e7

### @Zettat123 — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4274336172)

> When rerunning a single job, GHA lists all jobs that need to be rerun, including its downstream jobs. We can also support this feature in the future.
> 
> <img width="960" alt="image" src="https://github.com/user-attachments/assets/f57dbca7-4231-4c91-aac6-81ffd28f5ebb" />

### @silverwind — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4274429657)

> Yeah swap them, and ensure cancel button is also on left like this:
> 
> <img width="413" height="66" alt="image" src="https://github.com/user-attachments/assets/1aee4a54-998c-4ba7-9832-44c1bb0c2f7c" />

### @Zettat123 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4203532507)

> > 1. Would order buttons like `[attempt] [re-run all]`. People are use to buttons being at the same places.
> 
> > 2. Hide the button on first attempt, only show on subsequent ones (maybe that's already the case).
> 
> > Attempt switcher label differs from GitHub
> 
> Fixed by 7c8e2a8529ba8d3455898cd04b327695083ae9fc. Please see the latest screenshots in description.
> 
> > Race condition on concurrent reruns
> 
> 9dafc83696e6e66c40f88d7ef859b1252c58f0c4
> 
> > `RecreateTables` on `action_artifact` in migration v331
> 
> d1d6b5c7489972420b2aa22776e22a183a8e141a
> 
> > `actor` vs `triggering_actor` semantics
> 
> 8c5c5b98d9c6dd57e2612f42f9810dacc10a4c37
> 
> > Missing `previous_attempt_url` field
> 
> 3d488fbbd940be2c8a75c5c348994f99584035a1
> 
> >

### @silverwind — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/go-gitea/gitea/pull/37119#issuecomment-4239113653)

> A few review notes after going through the diff:
> 
> 1. **`GetLatestAttemptID` does a pointless DB round-trip** (`models/actions/run.go:175`). It fetches the attempt just to return `attempt.ID`, which equals `run.LatestAttemptID` already in memory. Either `return run.LatestAttemptID, nil` or drop the helper.
> 
> 2. **Destructive, irreversible migration** (`v331.go`). Dropping `action_run.concurrency_group` / `concurrency_cancel` means a downgrade to 1.26.x won't work. The rationale is sound but worth flagging in release notes.
> 
> 3. **`PreviousAttemptURL` lacks `omitempty`** (`modules/structs/repo_actions.go`). Attempt=1 runs will serialize `"previous_attempt_url": null`; a `*string` with `omitempty` would drop the key.
> 
> 4. **Hardcoded English ` by ` in the attempt switcher** (`web_src/js/components/RepoActionView.vue`). Needs a locale key — the surrounding panel already consumes `rerunTriggeredBy` / `triggeredViaBy`.
> 
> 5. **Transaction includes evaluator queries** (`execRerunPlan`). `EvaluateJobConcurrencyFillModel` + `PrepareToStartJobWithConcurrency` run inside `db.WithTx` per job. Probably fine, but worth benchmarking under Postgres contention for runs with many concurrency-scoped jobs.
> 
> 6. **Behavior change in rerun-failed not called out**. Old `GetFailedRerunJobs` transitively included downstream dependents; new `GetFailedJobsForRerun` returns only the failed jobs, and expansion is deferred to `expandRerunJobIDs` inside the plan builder. Net result matches GitHub, but a line in the PR body would help future readers.
> 
> 7. **`isLatestAttempt` logic is scattered**. Various sites c … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
