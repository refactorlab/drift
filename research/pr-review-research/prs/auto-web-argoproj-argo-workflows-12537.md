# argoproj/argo-workflows #12537 — fix: make sure taskresult completed when mark node succeed when it has outputs

**[View PR on GitHub](https://github.com/argoproj/argo-workflows/pull/12537)**

| | |
|---|---|
| **Author** | @shuangkun |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @juliev0
> So, it sounds like previously the execution of a Workflow was allowed to continue even if the previous Step's Outputs weren't reconciled? Are you essentially preventing the next Step from running yet in that case?

### @Garett-MacGowan
> I don't think this is an error. We just need to flag `needReconcileTaskResult`. Could maybe just log it normally if you want the log?

### @juliev0
> By the way, do we need to call it for both `woc.wf.Status.IsTaskResultInCompleted(node.ID) && woc.wf.Status.IsTaskResultInCompleted(pod.Name)`?

### @Garett-MacGowan
> I think it should just be `tmpl.HasOutputs() && woc.wf.Status.IsTaskResultInCompleted(node.ID)`

### @juliev0
> Sorry, I just realized that we probably need to move the `if err != nil` clause above the `if !podReconciliationCompleted {`, since we can return `err, false`

### @shuangkun
> Yes, I think this may be related to the introduction of taskresult resources since 3.4. Maybe it is hard to support old, because there is a lack of records recording whether the taskresult was processed.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
