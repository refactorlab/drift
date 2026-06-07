# crystal-lang/crystal #16264 — Add io_uring event loop (linux)

**[View PR on GitHub](https://github.com/crystal-lang/crystal/pull/16264)**

| | |
|---|---|
| **Author** | @ysbaddaden |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @straight-shoota
> I'm wondering if compatibility with older versions of the Linux kernel back to 5.19 is really necessary... it might be worth to think about dropping support for older versions before it becomes part of the stable stdlib.

### @straight-shoota
> I must admit that I'm not super familiar with the details of `io_uring`... But the code looks good overall and it has been more or less working for months now. So I'm pretty confident about merging it.

### @yxhuvud
> Identified that unlike single-ring implementations, the MT-safe design requires per-thread rings with cross-ring communication and completion queue stealing to prevent thread starvation.

### @ysbaddaden
> I wish the Linux kernel would just implement the `IORING_OP_SENDFILE` operation... or they'd just allow to splice from any fd to any fd instead of requiring one end to be a pipe.

### @ysbaddaden
> The implementation supports kernels 5.19+ while noting that best-effort support extends only through Linux 6.12, with 6.13+ recommended for stability.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
