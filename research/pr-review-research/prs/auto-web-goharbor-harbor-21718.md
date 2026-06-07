# goharbor/harbor #21718 — oidclogout

**[View PR on GitHub](https://github.com/goharbor/harbor/pull/21718)**

| | |
|---|---|
| **Author** | @wy65701436 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @reasonerjt
> I don't think of a use case where the user wants to end his 'OIDC session' but keep the 'offline session'. I think we should just provide the option for the user to end 'OIDC session' when he logs out from Harbor, and we always end the 'offline session' when the 'OIDC session' is terminated.

### @Vad1mo
> Can we not have a precise error message, explaining what actually went wrong?

### @reasonerjt
> Requested clarification on implementation details regarding session termination logic and proper handling of edge cases across different identity providers.

### @stonezdj
> Approved the changes after the author addressed feedback about simplifying the offline session handling approach.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
