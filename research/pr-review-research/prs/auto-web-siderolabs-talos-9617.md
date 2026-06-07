# siderolabs/talos #9617 — feat: machined: initial SELinux bring-up

**[View PR on GitHub](https://github.com/siderolabs/talos/pull/9617)**

| | |
|---|---|
| **Author** | @dsseng |
| **Status** | Merged (Nov 4, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @smira
> There are some existing Go libraries that might help: https://github.com/elastic/go-libaudit and https://github.com/mdlayher/netlink

### @smira
> SELinux parameters should be added to the kernel boot command line configuration

### @frezbo
> The amount of CIL code for initial bring-up could potentially be reduced further

### @smira
> Need to ensure executables receive proper context assignments during installation and switchroot phases

### @dsseng
> Labeling filesystems, devices and runtime files will be done in further changes, see the full PR

### @frezbo
> SELinux audit logs show permission denials that need policy refinement for containerd process transitions

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
