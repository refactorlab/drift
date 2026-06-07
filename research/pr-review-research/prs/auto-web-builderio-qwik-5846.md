# BuilderIO/qwik #5846 — feat(qwik-core): Uint8Array serializer

**[View PR on GitHub](https://github.com/BuilderIO/qwik/pull/5846)**

| | |
|---|---|
| **Author** | @genki |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wmertens
> it's missing tests—especially tests for edge cases involving non-printable characters, XSS result strings like `<script`, unicode modifiers etc.

### @wmertens
> Most likely you'll need an escape mechanism?

### @wmertens
> the code can be deduplicated by moving the functions out and making them into factories depending on odd/even

### @wmertens
> I think Qwik only supports utf-8 at the moment, so then base64 would be a better choice

### @wmertens
> For that you don't need any special esc handling

### @wmertens
> BTW, you can see how much this PR adds to the qwik bundle by looking at this line... you're adding 1kb of code, 400 bytes minified. Every byte helps

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
