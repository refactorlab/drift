# rook/rook #16689 — nvmeof: add nvme-of gateway crd support

**[View PR on GitHub](https://github.com/rook/rook/pull/16689)**

| | |
|---|---|
| **Author** | @OdedViner |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BlaineEXE
> I prefer to do initial major-feature development by stripping away as many automations and minor features as possible to still get to a useful working result

### @jhoblitt
> I agree strongly with @BlaineEXE that it is better to require explicit declaration of the pool rather than magic defaults

### @BlaineEXE
> A k8s deployment will end up having many pod names...Will this mean Ceph will register many unique gateway names for each pod restart?

### @BlaineEXE
> This was needed in the NFS script because NFS-Ganesha doesn't accept the `--mon-host` argument. If the commands we are running accept these args, we should use the args instead

### @BlaineEXE
> If we keep a default, we will always be obligated to keep it up to date. If we require it as input, we can avoid a minor, repeated...maintenance task

### @travisn
> Suggested change [to failureDomain]: osd → host (and size: 1 → size: 3)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
