# aquasecurity/trivy #8080 — feat(python): add support for uv

**[View PR on GitHub](https://github.com/aquasecurity/trivy/pull/8080)**

| | |
|---|---|
| **Author** | @nikpivkin |
| **Status** | Merged (December 19, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @DmitriyLewen
> I think we also need to skip `dev` group.

### @DmitriyLewen
> Create new issue for this case. please

### @DmitriyLewen
> Does the `dependencies` field contain these dependencies? If so, is there a `marker` for them

### @knqyf263
> Isn't `dependency-groups` you mentioned above about `pyproject.toml`? Does it mean `dependency-groups` are copied into `uv.lock`?

### @knqyf263
> Is it possible to identify the dependency graph for development dependencies? We can do that in another PR, though.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
