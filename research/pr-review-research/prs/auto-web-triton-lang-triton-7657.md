# triton-lang/triton #7657 — [Gluon][Tutorials] Add Tutorials

**[View PR on GitHub](https://github.com/triton-lang/triton/pull/7657)**

| | |
|---|---|
| **Author** | @Mogball |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Jokeren
> Why do we want to copy elements in such an inefficient way? Just to avoid attaching any layout?

### @peterbell10
> I think we can do a 1d add kernel to mirror the triton tutorial and this also gives us a simpler example to explain block layouts.

### @peterbell10
> Worth stating that we're massively bandwidth bound, hence why it's such a modest difference. In fact I wonder if it might be interesting to do something more complex like a classic mandelbrot or similar to better showcase the latency hiding abilities.

### @ThomasRaoux
> This looks like fantastic work. Unless there is a strong disagreement I would also suggest landing this and iterating with follow up PRs if needed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
