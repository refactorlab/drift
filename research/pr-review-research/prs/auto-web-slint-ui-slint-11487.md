# slint-ui/slint #11487 — New drag-and-drop type system

**[View PR on GitHub](https://github.com/slint-ui/slint/pull/11487)**

| | |
|---|---|
| **Author** | @eira-fransham |
| **Status** | Merged (May 8, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LeonMatthes
> We will need to discuss the construction side of the clipboard data types in Slint though...the component MIME type is now using text/plain in our preview UI, which it shouldn't.

### @LeonMatthes
> Another side note on this, maybe we should move away from using a property in the drag area, but rather have a callback like get-data so that we can load the data when you start the drag.

### @ogoffart
> The read side could still benefit a lot from optionals, so that you don't have to do two separate calls. But until we have those, this works well.

### @tronical
> A first round of review...Glad that we've settled on `DataTransfer` btw :)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
