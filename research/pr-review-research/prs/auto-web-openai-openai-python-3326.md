# openai/openai-python #3326 — [codex] Add Amazon Bedrock Responses support

**[View PR on GitHub](https://github.com/openai/openai-python/pull/3326)**

| | |
|---|---|
| **Author** | @jim-openai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @apcha-oai
> Main note is we should consider whether we want errors in the client or not. Philosophically putting these on the client will force users to update later as we cut releases which is slightly not ideal imo.

### @apcha-oai
> Consider: this is copying azure but may not evolve well to future configurations...peaceful with this for now though may be better to model within a separate struct and pass that in as config for future config updates

### @apcha-oai
> This seems a little strict but not sure what AWS's expectations are here, consider defaults

### @apcha-oai
> think you will need to readd the `workload_identity` on `copy` to keep types happy but other than that looks fine

### @jim-openai
> Right now bedrock/mantle only supports regional endpoints. Global is shipping within O(weeks), but I don't know the exact implementation yet. So I think we need to keep this for now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
