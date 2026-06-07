# apache/airflow #37948 — [AIP-49] OpenTelemetry Traces for Apache Airflow

**[View PR on GitHub](https://github.com/apache/airflow/pull/37948)**

| | |
|---|---|
| **Author** | @howardyoo |
| **Status** | ✅ merged |
| **Opened** | 2024-03-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +1032 / −4 across 15 files |
| **Engagement** | 25 conversation · 138 inline review comments |

## Top review comments (ranked by reactions)

### @howardyoo — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-2163029741)

> > I had a lot of conversation about open-telemetry and traces at Berlin Buzzwords and watched some talks and I really think it is going to make problem diagnosis and resolution much easier @howardyoo @ferruzzi - let's continue with the provider and get it out in 2.10 for people to start using it.
> 
> I'd like to express my gratitude to @potiuk and @ferruzzi for getting this done! Thank you so much. Yes, our next mountain should be the OTEL instrumentation piece, and also the OTEL providers. We haven't made the PR for part 2, but I'll start working on it. Thank you!

### @potiuk — 2 reactions  
`👍 2`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-2044624684)

> I tried to look at this PR finally and it is huge to review. I have a proposal though @howardyoo : Can you attempt to split split out adding traces separately for smaller subset a) add general functionality of enabling OTEL first, and then add "piece by piece" adding spans in different parts of Airflow that are focusing on one part of the code/functionality only? 
> 
> I think this will be far easier to review and we could pull in other people who would be more familiar with different parts of the code. The way I did it in the past - I kept my original PR as a DRAFT and then extracted part of it which could be separated out as standalone - much smaller and much more focused. Then After merging each small PR, I'd rebase the "complete" one and get it smaller and smaller once individual parts of it are merged.

### @dstandish — 2 reactions  
`❤️ 1 · 👀 1`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-2048324458)

> Yeah @howardyoo I think it's a good practice and will result in fewer errors.  Big bang PRs, while sometimes necessary, have a tendency for things to fall between the cracks, bugs and things to go unnoticed.
> 
> Let me share what I have been doing over the last month or so with my work on AIP-44 which I think has worked pretty well for all parties.
> 1. "get it sorta working"
> 2. do a soft reset to main
> 3. Look at your local changes, and identify small changes that make sense as a single unit.  Commit that, with a good name for the commit message.
> 4. Step through and repeat (3) till all your local changes are recommitted.
> 5. Copy the output of `git log --oneline` to text editor
> 6. Manipulate the lines to be 
> ```
> git checkout main
> git checkout -b <commit message>
> git cherry-pick <sha>
> ```
> So e.g. each line I do a replace of ` ` with `-` and make lowercase then I can use multiline editing to quickly convert to that format.
> So then e.g. 
> ```
> 5db845e493	Do not log event when using db isolation (4 hours ago) <Daniel Standish>
> eb4117c50f	Fix error when setting try_number from TaskInstancePydantic (4 hours ago) <Daniel Standish>
> a1d4eb0362	Remove unused attr _try_number on TaskInstancePydantic (4 hours ago) <Daniel Standish>
> 19dd3f2277	Fix check of correct dag when remote call for _get_ti (4 hours ago) <Daniel Standish>
> 4c6255b0c9	Add retry logic for RPC calls (4 hours ago) <Daniel Standish>
> ```
> becomes
> ```
> gco main
> git checkout -b do-not-log-event-when-using-db-isolation
> git cherry-pick 5db845e493
> gpsup
> 
> gco main
> git checkout -b fix-error-when-setting-try_number-from-taskinstancepydant … *[truncated]*

### @potiuk — 2 reactions  
`👍 2`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-2161203256)

> I had a lot of conversation about open-telemetry and traces at Berlin Buzzwords and watched some talks and I really think it is going to make problem diagnosis and resolution much easier @howardyoo @ferruzzi - let's continue with the provider and get it out in 2.10 for people to start using it.

### @potiuk — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-1998090772)

> Actually `breeze static-checks --only-my-changes` should run WAY faster and do 9X% up to 100% of the job.

### @potiuk — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/37948#issuecomment-2047713345)

> That works, maybe even split it to smaller pieces.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
