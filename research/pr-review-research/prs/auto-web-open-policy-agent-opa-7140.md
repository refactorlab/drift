# open-policy-agent/opa #7140 — Update docs and server binding addr per OPA v1.0 specs

**[View PR on GitHub](https://github.com/open-policy-agent/opa/pull/7140)**

| | |
|---|---|
| **Author** | @ashutosh-narkar |
| **Status** | Merged (Dec 19, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @johanfylling
> I wonder, should we really default to `0.0.0.0` if the `--v0-compatible` flag is set? This has security implications.

### @ashutosh-narkar
> This is existing behavior which the flag is supposed to maintain. We already have a section on the security implications of this in the docs and we also log a warning.

### @johanfylling
> We should drop this table entry, as this is part of the default `v1` constraints.

### @johanfylling
> I wonder if we need this section at all. The old OPA API will retain the v0 behaviour…

### @johanfylling
> Maybe [Integrating OPA](https://www.openpolicyagent.org/docs/latest/integration/) section?

### @charlieegan3
> I have rebased and regenerated it now. I have pushed directly to the branch.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
