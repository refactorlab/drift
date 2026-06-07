# ocornut/imgui #7865 — CI: Add manual trigger for 'workflow_run' builds

**[View PR on GitHub](https://github.com/ocornut/imgui/pull/7865)**

| | |
|---|---|
| **Author** | @learn-more |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @PathogenDavid
> I don't think you need to use `workflow_run` and the separate workflow for this. Unless I'm missing something you should be able to just add `workflow_disptatch` to `build.yml`'s event list.

### @learn-more
> That does not trigger the condition `github.event_name == 'workflow_run'`, which is used in the `build.yml` to build a bunch of extra things.

### @PathogenDavid
> Fair point, I didn't notice those conditions. They could probably just be changed but it's not a huge deal either way.

### @ypujante
> It simply runs the job which is defined to simply exit and does not work as advertised: 'This is a dummy workflow used to trigger full builds manually'

### @learn-more
> No, you are looking at the wrong thing. That triggers the 'build' workflow to do a full build.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
