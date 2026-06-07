# rust-lang/rust-clippy #12239 — Add `missing_transmute_annotations` lint

**[View PR on GitHub](https://github.com/rust-lang/rust-clippy/pull/12239)**

| | |
|---|---|
| **Author** | @GuillaumeGomez |
| **Status** | Merged (March 24, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @y21
> Looks like a really nice lint to have! Implementation looks pretty good already. Not sure about the category and if we want to have it be warn-by-default though - that might deserve discussion :)

### @Centri3
> If one/more of the types can be left inferred, can we keep it like that here? e.g., `let _: T`.

### @GuillaumeGomez
> I'd rather not. [This lint is] about making it explicit what the `transmute` types are (both input and output).

### @Centri3
> We should include closures here imo, if they have type annotations...Not something like `|x: i32| -> i64 unsafe { transmute(...) }`

### @y21
> The implementation seems more lax now (e.g. it allows a tail transmute expression in a function no matter how many other statements there are), but that's fine by me and should also make it less controversial.

### @y21
> It would probably be useful to have an optional configuration variable for disallowing inferred transmute node args _everywhere_ if a user specifically wants that behavior.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
