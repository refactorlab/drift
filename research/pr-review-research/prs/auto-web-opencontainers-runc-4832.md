# opencontainers/runc #4832 — libcontainer/intelrdt: add support for EnableMonitoring field

**[View PR on GitHub](https://github.com/opencontainers/runc/pull/4832)**

| | |
|---|---|
| **Author** | @marquiz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rata
> Where is this path? Inside the container? On the host?

### @rata
> Please remove the `fmt.Println()` lines

### @rata
> Who has control of this path? In runc this is trusted, okay, but is it exposed in k8s or containerd or some other to the user? Not sure with the intel/k8s-rdt-controller what is exposed to an end user

### @rata
> This mostly LGTM. But let's use the well-known table tests (or are you avoiding them for a reason?)

### @kolyshkin
> lgtm

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
