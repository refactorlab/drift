# ruby/ruby #13074 — Implement Set as a core class

**[View PR on GitHub](https://github.com/ruby/ruby/pull/13074)**

| | |
|---|---|
| **Author** | @jeremyevans |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @byroot
> It would be good to split the `set_table` internal implementation and the `Set` type, because there are other places in the VM that could benefit from using a `set_table`

### @byroot
> Would probably be better to embed the `set_table` and save a pointer chasing in most places. You can even use `RUBY_TYPED_EMBEDDABLE`

### @byroot
> I think you need `rb_gc_mark_movable` otherwise there is little point implementing `dcompact`.

### @byroot
> Not sure if it has an incidence, but in theory you are supposed to call `_WRITTEN` after having created the reference.

### @byroot
> However I don't know if you cherry-picked the commits...but it seems like [@mrnoname1000](https://github.com/mrnoname1000) authorship was lost

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
