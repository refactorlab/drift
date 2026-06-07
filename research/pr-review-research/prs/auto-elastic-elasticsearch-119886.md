# elastic/elasticsearch #119886 — ESQL: Initial support for unmapped fields

**[View PR on GitHub](https://github.com/elastic/elasticsearch/pull/119886)**

| | |
|---|---|
| **Author** | @GalLalouche |
| **Status** | ✅ merged |
| **Opened** | 2025-01-09 |
| **Repo** | curated review-culture seed |
| **Diff** | +4029 / −2399 across 53 files |
| **Engagement** | 15 conversation · 221 inline review comments |

## Top review comments (ranked by reactions)

### @elasticsearchmachine — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2585747671)

> Hi @GalLalouche, I've created a changelog YAML for you.

### @elasticsearchmachine — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2585748063)

> Pinging @elastic/es-analytical-engine (Team:Analytics)

### @GalLalouche — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2595849346)

> > Some quick comments, without going deep with the code:
> > 
> > * [disabling the _source](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-source-field.html#disable-source-field) should be covered so that whatever we do know should still happen after this PR
> > * [excluding certain fields from _source behavior](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-source-field.html#include-exclude) should also be kept as is. If we already have tests for this somewhere in yaml, csv or other IT tests, that's great and apologies for mentioning it.
> > * there is also the scenario where `index: false` and `doc_values: false` can be configured for a certain field. In this case, I guess this PR should address loading the value from `_source` as well (if _source is available, of course, considering my previous two use cases)
> 
> I've added a few more tests with `_source` disabled and specific fields excluded. `index` and `doc_values` are completely orthogonal to this feature though, as if they the field is mapped, this entire operation is a noop (for that particular index).

### @GalLalouche — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2598007721)

> > This is not a casting operation to `keyword`, as the error message seems to imply. I would have expected a `warning` message at most saying something like "there are no unmapped fields called [languages]".
> 
> Unfortunately, we don't currently keep any information on which index has the required mappings, and which don't (we only keep it in case of mapping conflicts). I would prefer to tackle the exact behavior of this edge case in another PR, as this would require a pretty large change of our index resolution.

### @elasticsearchmachine — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2600841622)

> Hi @GalLalouche, I've updated the changelog YAML for you.

### @GalLalouche — 0 reactions  
`—`  ·  [link](https://github.com/elastic/elasticsearch/pull/119886#issuecomment-2614439353)

> I've descoped a lot of the features in the PR, specifically, the resolution of union types on top of an `INSIST`. If there is any type conflict, i.e., if a field is mapped to anything other than `KEYWORD` in any index, it is no longer resolvable from within the language in this PR.
> 
> In addition, the resolved index now maintains a set of all partially mapped fields. This does not change metadata queried via field capabilities, and does not live past the analyzer, so it doesn't affect serialization.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
