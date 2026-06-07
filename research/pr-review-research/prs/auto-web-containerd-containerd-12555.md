# containerd/containerd #12555 — ctr: add EROFS image conversion support

**[View PR on GitHub](https://github.com/containerd/containerd/pull/12555)**

| | |
|---|---|
| **Author** | @ChengyuZhu6 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hsiangkao
> UpdateManifestPlatform prefers originalDesc.Platform when set. In an index, descriptor Platform often omits OSFeatures even when the config already has them, so this can accidentally overwrite `os.features` in the config with just `["erofs"]` (dropping existing OS features).

### @Copilot
> UpdateManifestPlatform always rewrites the config and manifest blobs, even when `erofs` is already present and the existing `os.features`/descriptor Platform already match the desired state.

### @Copilot
> `WithUpdateManifest` hooks are only invoked from `convertIndex`, so when converting an image whose target is a single manifest (not an index), the manifest/config updates will never run.

### @Copilot
> `updateManifestFunc` is invoked while holding `mu`. The callback can perform content store I/O, so holding the lock here serializes conversions and can significantly reduce parallelism.

### @Copilot
> Several exported identifiers in this new file are missing GoDoc comments. Add comments (or make them unexported) to satisfy linting and improve API clarity.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
