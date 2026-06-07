# kubernetes-sigs/cluster-api #11234 — ✨ Add v1beta2 structs to object status

**[View PR on GitHub](https://github.com/kubernetes-sigs/cluster-api/pull/11234)**

| | |
|---|---|
| **Author** | @fabriziopandini |
| **Status** | Merged (October 4, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JoelSpeed
> Do we need to care about whether this has been observed deliberately or not? Currently, since this is not a pointer and has no omitempty, when I marshal into json, I will get `desiredReplicas: 0`

### @JoelSpeed
> When would an UpToDate condition be true, or not? How would a user know what it means for an UpToDate condition to be true or not?

### @sbueringer
> I think it's not necessary for ClusterSpec and MachineSpec to be comparable. Such a requirement would also severely limit our options for API design

### @fabriziopandini
> out of date comments in our API (or out of date documentation in general) is an issue we are struggling with since a long time, and I think we should really stop doing things that could make this problem worst.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
