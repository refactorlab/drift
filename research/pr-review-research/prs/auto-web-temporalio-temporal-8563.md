# temporalio/temporal #8563 — PollComponent and PollActivityExecution

**[View PR on GitHub](https://github.com/temporalio/temporal/pull/8563)**

| | |
|---|---|
| **Author** | @dandavison |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bergundy
> Not blocking this PR but I don't think putting `chasm.` as a prefix for user configs is good practice.

### @bergundy
> I didn't review the tests very closely. There are still come open comments, please address before merging but I do not feel like I need another pass here.

### @yycptt
> Also need to change all EntityKey -> ExecutionKey

### @yycptt
> let's do it in ConflictResolveExecution as well. Create execution is probably fine, I guess there won't be any poller before execution is created.

### @yycptt
> I'd return invalidRequest here unless we are sure all api handlers have proper error conversion logic.

### @yycptt
> this is already checked in getExecutionLease? or it's for fixing the bug we discussed before...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
