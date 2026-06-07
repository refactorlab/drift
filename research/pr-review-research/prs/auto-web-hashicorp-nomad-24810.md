# hashicorp/nomad #24810 — docs: dynamic host volume specification

**[View PR on GitHub](https://github.com/hashicorp/nomad/pull/24810)**

| | |
|---|---|
| **Author** | @tgross |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gulducat
> huh, this isn't mentioned on the CSI page -- can they register with capacity like this? I suppose CSI register actually goes out and hits a plugin to get this?

### @gulducat
> out of curiosity - for create, does this call the plugin again? it shouldn't hurt anything (since the plugin 'must' be idempotent), but since the plugin isn't told about capabilities, we could avoid the RPC call.

### @tgross
> The parser for the volume spec ignores the field entirely for CSI. If you were to set it in the HTTP API it looks like it would get recorded in state, but it'd be completely ignored otherwise.

### @gulducat
> also, total tangent: we don't pass any kind of 'in use' info to the plugin for it to decide whether it can modify it... should we?

### @aimeeu
> I still need to do dynamic host volumes sections: Volume Placement, Updating a Volume Definition, and Examples.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
