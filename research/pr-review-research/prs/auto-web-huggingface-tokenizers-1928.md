# huggingface/tokenizers #1928 — Add type hint, update to pyo3 0.27, add automatic type hint generator

**[View PR on GitHub](https://github.com/huggingface/tokenizers/pull/1928)**

| | |
|---|---|
| **Author** | @ArthurZucker |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @McPatate
> Did you make sure the doc strings in the removed `pyi` files didn't have any drift with the docstrings in code?

### @McPatate
> did you do that yourself or is it `ty` that auto-sorts alphabetically?

### @McPatate
> is `_cls` used at all? do we leave it for backwards compat?

### @lalala-233
> Oh bro, you rename `cls` to `cls_token`, breaking the compatibility. I don't know why you did this.

### @ArthurZucker
> That's why the release is breaking 😉

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
