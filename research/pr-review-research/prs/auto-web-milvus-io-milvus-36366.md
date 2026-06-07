# milvus-io/milvus #36366 — feat: Add Text Embedding Function

**[View PR on GitHub](https://github.com/milvus-io/milvus/pull/36366)**

| | |
|---|---|
| **Author** | @junjiejiangjjj |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zhengbuqian
> is this max batch somehow exposed to the user? what if the user inserted rows more than MaxBatch in a single insert request?

(Design concern about batch-size handling.)

### @zhengbuqian
> I'd still change this method: accept both field and collSchema, if `field.GetIsFunctionOutput()`, then find the corresponding FunctionSchema

(Requesting unification of the function-checking logic.)

### @zhengbuqian
> I see no benefits of putting model names of different providers in the same location

(Architecture concern about code organization.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
