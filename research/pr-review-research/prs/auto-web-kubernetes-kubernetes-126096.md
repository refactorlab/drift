# kubernetes/kubernetes #126096 — kubelet: new kubelet config option for disabling group oom kill

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/126096)**

| | |
|---|---|
| **Author** | @utam0k |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @liggitt
> /approve /hold for a nit on config field godoc to align with the yaml values users will specify, and one fix needed on the build tagging

### @roycaihw
> Flagged an outdated comment requiring resolution on the types.go file so the configuration documentation aligns with the yaml values users specify.

### @dchen1107
> LGTM overall. Please address @roycaihw's comments above and fixed the failing tests. We are ready to go.

### @liggitt
> /lgtm /hold cancel

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
