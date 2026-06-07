# grafana/k6 #4671 — Integrate Binary provisioning

**[View PR on GitHub](https://github.com/grafana/k6/pull/4671)**

| | |
|---|---|
| **Author** | @pablochacin |
| **Status** | Merged (May 2, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joanlopez
> I'd say I have seen this literal string at least a couple of times along this PR, so I'd prefer if we can move this into a `const`, so prevent mistakes in the future

### @joanlopez
> In case we run `k6 cloud run` with `--local-execution`, I think this should return `false`...Or, do we intentionally want to run a custom binary locally in such case?

### @oleiade
> I tend to prefer, when possible, defining and implementing an interface (`Provisioner`?), instead of a callback...It's much easier to go to definition of an interface

### @codebien
> Can you open and add an issue to the stability epic, please?

### @codebien
> Help for subcommands seems an additional issue with the current solution (e.g. `K6_BINARY_PROVISIONING=1 k6 cloud run --help` producing incorrect errors)

### @pablochacin
> My understanding is that we accepted this as a limitation for the preview and document it as a known issue..It is documented here: #4727

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
