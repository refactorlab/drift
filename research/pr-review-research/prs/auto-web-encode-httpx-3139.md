# encode/httpx #3139 — Add support for zstd decoding

**[View PR on GitHub](https://github.com/encode/httpx/pull/3139)**

| | |
|---|---|
| **Author** | @mbeijen |
| **Status** | Merged (March 21, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lovelydinosaur
> This is a lovely bit of functionality. Missing some coverage at the moment.

### @lovelydinosaur
> Three key requirements before merge: proper attribution to the urllib3 team in code comments, a real-world example URL for testing, and a CHANGELOG entry.

### @mbeijen
> Responded with evidence that zstd support exists on major sites (Instagram, Facebook, Caddy) and that Mozilla shifted its standards position to "positive" in October 2023, establishing real-world relevance.

### @lovelydinosaur
> Demonstrated successful testing against caddyserver.com showing zstd content-encoding working correctly: "Content-Encoding: zstd" with successful decompression.

### @Zaczero
> Multiple technical comments on code implementation details, requesting adjustments to decoder structure and compatibility handling. Approved after revisions were made.

---
*Note: Some of the above are paraphrased summaries where the web page did not expose full verbatim review-thread prose; reviewer names and the gist of each comment are preserved.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
