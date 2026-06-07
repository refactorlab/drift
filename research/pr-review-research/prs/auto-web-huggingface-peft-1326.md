# huggingface/peft #1326 — Adding BOFT: Parameter-Efficient Orthogonal Finetuning via Butterfly Factorization

**[View PR on GitHub](https://github.com/huggingface/peft/pull/1326)**

| | |
|---|---|
| **Author** | @yfeng95 |
| **Status** | Merged (April 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BenjaminBossan
> Would it be possible to add this as an extension to the existing OFT adapter in PEFT instead of a completely separate method?

### @BenjaminBossan
> Could you please add references to where that code is being adapted from?

### @BenjaminBossan
> Are you sure that when a package is built, it will automatically include the non-Python files?

### @yfeng95
> The implementations of BOFT and OFT are very different, so decided to pr as a completely separate method

### @yfeng95
> Only when people running BOFT, it will automatically compile the cuda kernels.

### @pacman100
> This should also be skipped for AdaLoRA as before, right?

### @pacman100
> Thank you for the commendable job on adding BOFT with detailed docs, thorough examples and usecases, clear implemenatation with custom CUDA kernels and thorough tests

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
