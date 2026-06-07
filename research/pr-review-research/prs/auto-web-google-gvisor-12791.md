# google/gvisor #12791 — feat(shim): implement containerd Task.Update for cgroup resize

**[View PR on GitHub](https://github.com/google/gvisor/pull/12791)**

| | |
|---|---|
| **Author** | @a7i |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @milantracy
> can you add integration test at test/root/crictl_test.go you can test locally by make containerd-test-2.1.0

### @ayushr2
> The description mentions that `Container.Update now branches...` But that is not yet implemented AFAICT. There is no `updateSubcontainerResources()` function.

### @ayushr2
> I think this is incorrect, that `s.id` is the sandbox ID. `s.id` is still the container ID. In gVisor, as of now, we have 1 shim per container.

### @natasha41575
> I think it was incorrect to say _nothing_ in runsc should change. runsc didn't need to update the cgroups...but runsc still needs to be notified.

### @ayushr2
> IIUC...you also observe the same error while trying to resize a Pod? (referring to "update can only be called on the root container")

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
