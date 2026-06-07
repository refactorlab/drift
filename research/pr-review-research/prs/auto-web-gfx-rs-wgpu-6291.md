# gfx-rs/wgpu #6291 — Ray Queries

**[View PR on GitHub](https://github.com/gfx-rs/wgpu/pull/6291)**

| | |
|---|---|
| **Author** | @Vecvec |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cwfitzgerald
> However we don't actually want to block it at this stage so our resolution to this problem is to let it in basically as is. The one change that we want to make is prefix the feature flag with EXPERIMENTAL_

### @teoxoy
> I think the way the new `command_encoder_build_acceleration_structures` use pending writes is not sound or at least not what it was designed for.

### @teoxoy
> `Tlas.destroy` don't seem to check if the `Tlas` is used in a bind group of an active submission...I think we can remove the destroy methods on the acceleration structures for now

### @JMS55
> So sounds like we can merge once you rename the feature flag :)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
