# argoproj/argo-cd #17403 — feat: Decoupling application sync using impersonation

**[View PR on GitHub](https://github.com/argoproj/argo-cd/pull/17403)**

| | |
|---|---|
| **Author** | @anandf |
| **Status** | Merged (September 4, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jgwest
> There is a plan to implement it, if we receive sufficient interests. Since, it affects the security posture, we want to have the admins to control it.

### @60k41p
> having the SA association at Application level planned? It seems to me that having this at Project level would force users to have one Project per Application if each app has its own deployer SA.

### @anandf
> Different applications having different destinations can then be targeted to the same guestbook-proj.

### @Ampler92
> Is there a way to enable this feature and then use it only for specific projects?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
