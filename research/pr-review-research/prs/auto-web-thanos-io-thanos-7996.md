# thanos-io/thanos #7996 — [FEATURE] adding otlp endpoint

**[View PR on GitHub](https://github.com/thanos-io/thanos/pull/7996)**

| | |
|---|---|
| **Author** | @nicolastakashi |
| **Status** | Merged (January 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @saswatamcode
> I did recommend copying the translator struct over to use thanos protos natively instead of doing a full conversion, but it could be a maintenance burden.

### @pedro-stanaka
> I am not a huge fan of the whole copying files over, but I am okay with it in name of optimization...We already have duplication because of Capn Proto ingestion and now also because of OTLP.

### @matej-g
> I think it would be good to have a separate documentation section to explain the OTLP endpoint and mainly to explain the behavior of resource attributes.

### @saswatamcode
> otlptranslator duplication to use zlabels...would cause some maintenance burden overall, we can choose to remove later if that were to be the case.

### @GiedriusS
> This will be called lots of times...maybe this function could accept a `[]byte` so that we could pool this buffer?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
