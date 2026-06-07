# apache/superset #36368 — feat: add global task framework

**[View PR on GitHub](https://github.com/apache/superset/pull/36368)**

| | |
|---|---|
| **Author** | @villebro |
| **Status** | ✅ merged |
| **Opened** | 2025-12-02 |
| **Repo importance** | ★73,183 · 17,524 forks · score 148,279 |
| **Diff** | +15538 / −294 across 89 files |
| **Engagement** | 22 conversation · 163 inline review comments |

## Top review comments (ranked by reactions)

### @villebro — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3826484726)

> @mistercrunch I've addressed all the issues you identified in the review. Lots of great catches there, thanks! I'll do a few more rounds of review to ensure the code is solid, but in general I think this feature is approaching a mergeable state.

### @villebro — 1 reactions  
`🚀 1`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3832455882)

> @mistercrunch we can definitely throw in a feature flag that defaults to bypassing the framework if stability and/or overhead is a concern. And I don't see any reason why we can't add a denylist that admins can use to progressively start diverting tasks to the framework when they do decide to enable it.
> 
> Btw, as a small teaser, I was able to move thumbs to the framework with minimal effort with full deduplication and cancellation support (Claude had no trouble doing this thanks to the user docs). Pretty sweet 🤩 
> <img width="1719" height="817" alt="image" src="https://github.com/user-attachments/assets/f81a8a25-1462-481a-8b3e-62ba918ca3bd" />

### @villebro — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3849971147)

> > I have a small nit with this approach. We are basically saying we won't need to filter tasks by these properties right? It looks like we could go with the columns approach with only downside being migration requirement ( which i think is reasonable .)
> 
> Thanks for reviewing the proposal @msyavuz! I'm not super opinionated on this, so if there's pushback against the blob-first approach I'm open to moving these into dedicated fields. While working on this I just noticed there will likely be a need for adding new fields during migration to GTF, and I didn't want to burden those migrations with having to do a db migration every time a new property is needed. And adding them up front would likely have missed a few, requiring migrations anyway.
> 
> As a compromise how does this sound: we go with blob approach for now, and once we've migrated all legacy tasks to GTF and have a full understanding of fields required for internal use cases, we do a big db migration that breaks them out into dedicated fields?

### @villebro — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3850028379)

> @michael-s-molina and @mistercrunch: I have done extensive work to minimize overhead as much as possible: heavy optimization of current distributed locking feature, use atomic SQL wherever possible (only use locks when explicitly needed), throttle updates originating from task etc. Please re-review the updated description for all the changes introduced.
> 
> @mistercrunch: regarding your comment on providing a gradual path for migrating legacy tasks to GTF: I've now added a feature flag, so the feature will not be made generally available until it's gone through extensive hardening. For the task migration, I'm proposing creating new GTF-enabled tasks that will be used when the FF is flipped, but continue using the old tasks for envs where GTF isn't enabled. I did some testing to see if supporting direct Celery scheduling with the new task decorator would be possible, but it added a lot of dangerous complexity to the already complex internals of the feature, so ultimately I decided against it. But if you feel strongly about being able to run legacy tasks in parallel with GTF, e.g. with a progressive rollout where you could define a percentage of thumbnails to be scheduled on GTF vs pure Celery, I'm happy to bake that in. However, I suspect it will just add confusion ("why am I only seeing some tasks on the list view?", "why are some tasks failing while others are not?", "why is this thumbnail sometimes deduplicated and other times not?" etc). So I would recommend just hardening the hell out of this feature in the next few months, and then releasing to a few canary deployments to … *[truncated]*

### @villebro — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3854554524)

> > Sync join-and-wait - the whole pitch of GTF is getting long-running work off web workers, but when a sync caller hits a deduplicated task, join-and-wait blocks the web worker polling until the async task completes doing zero useful work. What's the scenario where that's the right call vs just forcing callers to .schedule() and returning a task UUID?
> 
> There are a few motivations:
> - Celery isn't a hard requirement right now. To make sure we can provide DRY execution paths for sync and async workflows, we need to be able to have support for executing tasks synchronously, while still being able to leverage the deduplication and abort functionality that the framework offers. A prime candidate for this type of consolidation is collapsing the current sync vs async chart query flows into a single GTF based flow.
> - Even with async capabilities, you may have workflows where you prefer sync execution. I noticed we're currently generating thumbnails synchronously with the `superset compute-thumbnails` CLI command. Providing async only would require extra boilerplate for awaiting task completion. There could be other similar cases even in async flows, when a task has a dependency on another task, and wants to block until the dependent task finishes. This is going into DAG territory, and not something that we'd widely encourage, but I can see the cases where this could be handy.
> 
> > Also noticed the @task decorator checks is_feature_enabled("GLOBAL_TASK_FRAMEWORK") at import time, not at call/schedule time. So if any module with @task-decorated functions gets imported during app startup … *[truncated]*

### @michael-s-molina — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/36368#issuecomment-3790544397)

> This is looking great! For now, I’ve just reviewed the PR description since you mentioned you’re still making changes to the code.
> 
> - It might be worth considering renaming the variable `is_abortable` (in the state diagram/code) to `aborting`. As it stands, having a task in progress with `is_abortable = False` could give the impression that the task cannot be aborted.
> - I noticed you added the new tables to the PR description, which is really helpful. Could we also include a section outlining the new APIs?
> - You mentioned that GTF falls back to polling if a Redis operation fails. When exactly is this failed operation processed, given that polling won’t be enabled in deployments using Redis?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
