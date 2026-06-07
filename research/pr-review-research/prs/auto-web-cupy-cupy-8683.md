# cupy/cupy #8683 — ENH: Implement dlpack v1

**[View PR on GitHub](https://github.com/cupy/cupy/pull/8683)**

| | |
|---|---|
| **Author** | @seberg |
| **Status** | Merged (Nov 5, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @leofang
> I grudgingly ignore the readonly flag right now on import, because we may need a way to ignore it.

### @leofang
> We support device requests if the device matches exactly _or_ when the request is to copy to the CPU.

### @leofang
> generally, to access managed memory on CPU safely, a synchronization is needed, DLPack assumes a safe handover is done, implying users should not need to do anything themselves

### @seberg
> stream=None: synchronize after copying...stream=current_stream: Consumer synchronizes. The operation is never blocking.

### @leofang
> One potential use case is an async array library (like PyTorch) supporting both CPU/GPU access, then even on the CPU side they could have a `stream` that can be passed

### @seberg
> I did not add support for `from_dlpack(..., dl_device!=None)`, because the main point of that is currently [external].

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
