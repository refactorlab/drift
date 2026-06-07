# nektos/act #2265 — Support overwriting caches

**[View PR on GitHub](https://github.com/nektos/act/pull/2265)**

| | |
|---|---|
| **Author** | @wolfogre |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ChristopherHX
> Yes this is probably true in act, since the run_number, run_id, run_attempt doesn't update automatically.

### @ChristopherHX
> If we have same scope key and version it still fails on GitHub Actions

### @wolfogre
> I am sure GitHub Actions support multiple caches with the same key

### @ChristopherHX
> We should alter the orderby statement to always return exact matched keys first, regardless of position in the list

### @ChristopherHX
> I cannot reproduce my concerns..., let's merge

### @ChristopherHX
> Created a followup #2267

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
