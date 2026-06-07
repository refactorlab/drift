# prisma/prisma #29038 — feat: query plan caching

**[View PR on GitHub](https://github.com/prisma/prisma/pull/29038)**

| | |
|---|---|
| **Author** | @aqrln |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Despite a high total comment count, the visible review discussion on this PR was dominated by automated `coderabbitai` checks (docstring coverage, PR-title suggestions) plus a brief human approval. Substantive human review prose was sparse in the rendered conversation page.

### @jacek-prisma
> LGTM, with 2 minor comments

(The two minor inline comments were marked resolved on `TSClient.ts`/`batch.ts`; their verbatim text did not render on the public conversation page.)

The most substantive technical content lives in the PR description itself rather than in review comments: it describes schema-aware parameterization, an expected ~100% cache hit rate, and a compilation-cost reduction from roughly 0.1–1 ms to 1–10 µs on cache hits.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
