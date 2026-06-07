# containerd/containerd #10579 — Add OCI/Image Volume Source support

**[View PR on GitHub](https://github.com/containerd/containerd/pull/10579)**

| | |
|---|---|
| **Author** | @wzshiming |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fuweid
> Checked the code and found that snapshot creation doesn't use lease so that containerd GC cleanups the volume after creation...please consider using the following code to fix.

### @fuweid
> I think this case fails...Would you please show more log in your commit? It would be easier to fix.

### @fuweid
> sure. we can have track item to add test in windows.

### @mikebrow
> hmm.. a timeout .. maybe use BusyBox it should always be smaller..

### @carlory
> FYI cri adds the subpath support for image volume type

### @mikebrow
> that works!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
