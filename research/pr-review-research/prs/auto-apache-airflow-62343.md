# apache/airflow #62343 — Add async connection testing via workers for security isolation

**[View PR on GitHub](https://github.com/apache/airflow/pull/62343)**

| | |
|---|---|
| **Author** | @anishgirianish |
| **Status** | ✅ merged |
| **Opened** | 2026-02-23 |
| **Repo** | curated review-culture seed |
| **Diff** | +4204 / −110 across 61 files |
| **Engagement** | 20 conversation · 218 inline review comments |

## Top review comments (ranked by reactions)

### @kaxil — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-3961599489)

> > @pierrejeambrun  thank you very much for the review. The dev list discussion ([thread](https://lists.apache.org/thread/xd7zmyp95y77cw36mb5wjp17dyynz100)) received positive feedback , and the implementation follows the suggestions outlined in the thread. Happy to wait for a more formal conclusion on the thread. Would love to know if there's anything you'd like me to    revisit or improve in the meantime.
> 
> I do plan to review proposal, PR and reply but occupied today. So tomorrow or Friday.
> 
> There isn't any hurry either since earliest this would go would be 3.2 anyway and there is some time to go for it.

### @pierrejeambrun — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-4336352723)

> Feel free to resolve comments you have addressed so we know if works remain to be done before the next review.

### @Vamsi-klu — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-4584957633)

> I found two blockers in the current head:
> 
> 1. The worker success path drops team ownership when `commit_on_success=True` creates a brand-new connection. The public API resolves and authorizes the effective team, then stores it on `ConnectionTestRequest`, but `commit_to_connection_table()` creates the new `Connection(...)` without `team_name=self.team_name`. In multi-team mode that can turn a team-scoped connection credential into a persisted global connection. Please copy the team on creation and add a regression test for a new team-owned connection with `commit_on_success=True`.
> 
> 2. The UI still appears to exercise the old synchronous API-server test path, so the main UI workflow does not get the worker-isolation behavior added by this PR. `useTestConnection.ts` still calls the generated client for `/api/v2/connections/test`, and that route still executes `conn.test_connection()` inside the API server process. If the intent is for UI connection tests to be isolated from the API server, the UI should enqueue the test and poll by token, or the old API-server route should be separately gated/deprecated so enabling connection testing does not keep exposing the synchronous API-server execution path.
> 
> ---
> Drafted-by: Codex (GPT-5); reviewed by @Vamsi-klu before posting

### @anishgirianish — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-4585025031)

> > I found two blockers in the current head:
> > 
> > 1. The worker success path drops team ownership when `commit_on_success=True` creates a brand-new connection. The public API resolves and authorizes the effective team, then stores it on `ConnectionTestRequest`, but `commit_to_connection_table()` creates the new `Connection(...)` without `team_name=self.team_name`. In multi-team mode that can turn a team-scoped connection credential into a persisted global connection. Please copy the team on creation and add a regression test for a new team-owned connection with `commit_on_success=True`.
> > 2. The UI still appears to exercise the old synchronous API-server test path, so the main UI workflow does not get the worker-isolation behavior added by this PR. `useTestConnection.ts` still calls the generated client for `/api/v2/connections/test`, and that route still executes `conn.test_connection()` inside the API server process. If the intent is for UI connection tests to be isolated from the API server, the UI should enqueue the test and poll by token, or the old API-server route should be separately gated/deprecated so enabling connection testing does not keep exposing the synchronous API-server execution path.
> > 
> > Drafted-by: Codex (GPT-5); reviewed by @Vamsi-klu before posting
> 
> Hi @Vamsi-klu  thank you so much for your review. 
> 
> 1.  Addressed thanks
> 
> 2. UI changes are not part of this pr and will come along in a follow-up as stated in Pr description.
> 
> I think this clears the blockers. Thank you

### @anishgirianish — 0 reactions  
`—`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-3946352063)

> @jason810496  Thanks for the thorough review! Addressed your feedback in the latest push:                                                                    
>  
> - Removed `result_status` column — `state` is sufficient                                       
> - Moved `_ImportPathCallbackDef` to `connection_test.py` with a `create_callback()` factory  method
> 
>  Could you please take another look when you get a chance? Thanks!

### @anishgirianish — 0 reactions  
`—`  ·  [link](https://github.com/apache/airflow/pull/62343#issuecomment-3957676083)

> @jason810496 Thanks for the review! I have addressed it in the latest push.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
