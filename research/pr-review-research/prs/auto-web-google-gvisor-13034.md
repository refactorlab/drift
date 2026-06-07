# google/gvisor #13034 — feat: Support running createContainer hooks in CDI spec

**[View PR on GitHub](https://github.com/google/gvisor/pull/13034)**

| | |
|---|---|
| **Author** | @LandonTClipp |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ayushr2
> I don't understand this part and why the `nvidia-ctk hook update-ldcache` hook can not be run normally in the gofer.

### @ayushr2
> I think if we take the approach of adding general support for running `CreateContainer` in the gofer before pivot_root, I think your fix will be backwards compatible

### @shayonj
> If we self-bind `spec.Root.Path`, apply the CDI mounts and `/dev` setup there, run the hooks, and then recursively bind that prepared tree to `/proc/fs/root`

### @ayushr2
> the container rootfs provided in the OCI spec is read-only from the beginning and the spec doesn't contain any mounts

### @ayushr2
> Could you please squash the commits. Copybara doesn't have the ability to squash and merge yet so all commits from PR are applied.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
