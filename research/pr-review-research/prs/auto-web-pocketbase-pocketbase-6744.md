# pocketbase/pocketbase #6744 — Generate webp thumbnails

**[View PR on GitHub](https://github.com/pocketbase/pocketbase/pull/6744)**

| | |
|---|---|
| **Author** | @KevSlashNull |
| **Status** | Merged (Apr 20, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @KevSlashNull
> i saw that you wrote in #825 (comment) that webp thumbs would be out-of-scope for v1.0, so no worries if you don't want to include this.

### @ganigeorgiev
> As mentioned in the linked comment, I wanted to avoid the workaround of converting them to jpg/png but since webp thumbs seems to be a common request I guess it could be better than nothing.

### @qoheleth-tech
> Does this mean that the thumbnail will be a `webp` file but have a `png` extension; or that the thumbnail will be a `png` with a `png` extension; or that the thumbnail will keep the `webp` extension but actually be a `png` image?

### @ganigeorgiev
> The generated thumb image should be png but the extension will be the same as the original (it shouldn't really matter anyway because we don't trust it).

### @ganigeorgiev
> In the end it is better than nothing, so let's merge it. If it ended up causing issues we can always revert it. I'll update also the tests to add a mimetype thumb check to ensure that the fallback png is properly generated.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
