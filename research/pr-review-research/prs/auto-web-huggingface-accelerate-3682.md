# huggingface/accelerate #3682 — Parallelism config + TP + HSDP + BYODM (Bring Your Own Device Mesh)

**[View PR on GitHub](https://github.com/huggingface/accelerate/pull/3682)**

| | |
|---|---|
| **Author** | @salmanmohammadi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SunMarc
> `|` syntax only works with py3.10 but we still need to support py3.9

### @SunMarc
> You mean `ParallelConfig` no?

### @SunMarc
> yeah we should probably raise an error but tbh we don't really need to deal with this case

### @S1ro1
> we will drop py3.9 in october btw !

### @SunMarc
> nice ! We will be able to clean up a bit trainer code after that

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
