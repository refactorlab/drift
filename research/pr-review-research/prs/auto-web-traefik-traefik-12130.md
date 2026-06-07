# traefik/traefik #12130 — Multi-layer routing

**[View PR on GitHub](https://github.com/traefik/traefik/pull/12130)**

| | |
|---|---|
| **Author** | @sdelicata |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kevinpollet
> makeServiceKey should be fixed to not return an error, as the Write method from a hasher never returns an error per the GoDoc.

### @kevinpollet
> the naming of this function is a bit misleading as we are computing a router name and not a service name.

### @kevinpollet
> Series of design-focused requests regarding the Kubernetes CRD provider implementation for parent reference resolution and validation logic, focusing on cross-namespace support constraints and configuration correctness verification. (Verbatim text of each individual inline thread was not retrievable from the web page; these were requested-changes reviews dated Oct 14–17, 2025.)

### @juliens
> LGTM

> **Note:** This PR's conversation was dominated by inline code-review threads from @kevinpollet; the two quoted comments above are the substantive ones whose verbatim text was web-retrievable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
