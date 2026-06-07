# protocolbuffers/protobuf #21880 — Manually backport Pure Python recursion limit enforcement to 25.x

**[View PR on GitHub](https://github.com/protocolbuffers/protobuf/pull/21880)**

| | |
|---|---|
| **Author** | @shaod2 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zerlok
> Backward compatibility with 4.25.7 was broken here. Now I'm getting `google.protobuf.message.DecodeError: Error parsing message: too many levels of nesting.`

### @shaod2
> Try adding `from google.protobuf.internal import decoder...decoder.SetRecursionLimit({YOUR_LIMIT})`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
