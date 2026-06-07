# apache/airflow #55068 — Re-enable start_from_trigger feature with rendering of template fields

**[View PR on GitHub](https://github.com/apache/airflow/pull/55068)**

| | |
|---|---|
| **Author** | @dabla |
| **Status** | ✅ merged |
| **Opened** | 2025-08-29 |
| **Repo** | curated review-culture seed |
| **Diff** | +922 / −192 across 19 files |
| **Engagement** | 30 conversation · 155 inline review comments |

## Top review comments (ranked by reactions)

### @ashb — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-3249775064)

> https://github.com/apache/airflow/blob/3.0.0rc3/airflow-core/newsfragments/aip-66.significant.rst
> 
> > Dag bundles are not initialized in the triggerer. In practice, this means that triggers cannot come from a dag bundle. **_This is because the triggerer does not deal with changes in trigger code over time, as everything happens in the main process_.** Triggers can come from anywhere else on sys.path instead.
> 
> (Emphasis mine)

### @ramitkataria — 1 reactions  
`🚀 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-3268434918)

> This would also be very useful for async callbacks (currently used for Deadline Alerts) running in the triggerer! Once this is merged in, I could create a followup PR to replace the implementation in https://github.com/apache/airflow/pull/55241

### @ashb — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-3270683599)

> SerializedDagBag already exists in the form of SchedulerDagBag I think -- rather than a new one, it might be better to rename that one if it otherwise fits your need

### @potiuk — 1 reactions  
`😄 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-3410380155)

> Is this one sort of ready for review :) ?

### @Lee-W — 1 reactions  
`🚀 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-3609946360)

> I would like to take another look this or early next week. It would be nice if we could get the conflict resolved :) Thanks a lot!

### @eladkal — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/55068#issuecomment-4055104126)

> > I assume this is ready. 
> 
> The PR is still in draft. so if the code is OK and all tests passes it would be good @dabla to mark it as ready for review


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
