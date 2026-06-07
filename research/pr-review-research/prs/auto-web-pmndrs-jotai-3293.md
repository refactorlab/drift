# pmndrs/jotai #3293 — breaking(internals): avoid getInternalBuildingBlock function

**[View PR on GitHub](https://github.com/pmndrs/jotai/pull/3293)**

| | |
|---|---|
| **Author** | @dai-shi |
| **Status** | Merged (May 5, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dmaskasky
> My initial thought is that rest/spread adds overhead to these internal functions. Many of the functions only require passing `store` since atomOnInit needs it.

### @dmaskasky
> Passing store in buildArgs is technically possible, but should not affect anything. I recommend putting `buildingBlocks[29] = store` after this line to overwrite buildArgs[29].

### @dai-shi
> I don't like it then. If we specialize store like that, I wouldn't put it into the building blocks.

### @dmaskasky
> Then let's `void` it from the buildArgs.

### @dmaskasky
> we should still pass the store as the second param.

### @dai-shi
> @dmaskasky reported this breaking change makes jotai-scope unmaintainable. Let's start over when we get time.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
