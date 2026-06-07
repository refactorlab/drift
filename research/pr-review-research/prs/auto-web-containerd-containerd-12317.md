# containerd/containerd #12317 — pkg/sys: Create user namespace as the container's initial user namespace user

**[View PR on GitHub](https://github.com/containerd/containerd/pull/12317)**

| | |
|---|---|
| **Author** | @halaney |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rata
> Do we really need to do this manually? If we set it in the go struct, now that is after the setresuid, is not enough?

### @rata
> But this unprivileged user of course can't map IDs other than itself. So we need this to be done from the root process.

### @rata
> I think trying it as unprivileged and then fallback as doing it as root _might_ be the best way forward.

### @rata
> A function that inside has an anonymous function, that inside has a defer function, that inside does two nested ifs. Let's simplify this.

### @rata
> The targetHostUID should be -1. In that case, it is not changed according to the manpage then, the caller should set it to -1 instead of the current uid.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
