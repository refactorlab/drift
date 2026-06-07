# encode/starlette #2697 — Add support for HTTP Range to `FileResponse`

**[View PR on GitHub](https://github.com/encode/starlette/pull/2697)**

| | |
|---|---|
| **Author** | @Kludex |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @trim21
> We should pre-compile regex pattern. Althrough `re` has a built-in cache, but it has size limit and for project using many regex it still may be invalidated and pattern get re-compiled.

### @graingert
> I'm a bit concerned that this uses predictable randomness. I'd be tempted to go for 19 characters using SystemRandom.choices to get 96 bits of entropy

### @frostming
> Does it send all content within the range?...may not send full content if the chunk_size is smaller, and you didn't send the rest anywhere in this branch.

### @trim21
> why `join(random_choices)` anyway? It's also slower than `secrets.token_hex(6/7/13)` unless 13 has some special meaning here.

### @abersheeran
> This is predicted to be secure...it does not serve any cryptographic purpose.

*Note: GitHub's review-thread prose was only partially web-retrievable; quoted lines above are verbatim where shown.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
