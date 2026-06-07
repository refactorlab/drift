# temporalio/temporal #9614 — Callback for workflow update support

**[View PR on GitHub](https://github.com/temporalio/temporal/pull/9614)**

| | |
|---|---|
| **Author** | @Quinn-With-Two-Ns |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bergundy
> I think we need just one more round here. For when updates are already completed, let's make sure to generate the new link type we discussed server-side.

### @bergundy
> I think limiting all of the workflow callbacks, regardless of what component they're attached to makes more sense than a per component limit due to the fact that the entire tree needs to be loaded into memory when mutable state is accessed today.

### @bergundy
> We need to fire all of the standby update callbacks as soon as the run they are attached to completes. This is slight different than what we do with workflow close callbacks, that can be reattached to a following run if the workflow retries or continues as new.

### @long-nt-tran
> added handling for `stateAdmitted`, should be same as `stateSent` but returns `false, nil` since IIUC caller still needs to create the speculative WFT at this stage

### @long-nt-tran
> cc @bergundy LMK if this is right, I think we need to fire update callbacks here as well...caller workflow would just timeout since the update completion callbacks never fired.

### @stephanos
> I know it's not wrong, but ... WorkflowUpdateOptionsUpdate 😬

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
