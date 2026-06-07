# rust-lang/rustfmt #6212 — Impl rewrite_result for ast nodes in items.rs

**[View PR on GitHub](https://github.com/rust-lang/rustfmt/pull/6212)**

| | |
|---|---|
| **Author** | @ding-young |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ytmimi
> This isn't something we need to address right now, but I've noticed a lot of `.ok_or_else(|| { RewriteError::ExceedsMaxWidth {..} })` calls throughout the code. I wonder if we can make this a little more ergonomic.

### @ytmimi
> Define an extension trait so we can more easily convert from `Option<T>` -> `Result<T, RewriteError>`. Here's one idea that I had: `pub(crate) trait RewriteErrorExtension<T> {...}`

### @ytmimi
> If you feel like it would be a lot to extend the scope of the current PR then we can always revisit modifying all of these functions in future PRs, but if it's not a heavy lift then we might want to consider doing some of that work in this PR.

### @ytmimi
> One thing I've been wondering is whether we should use `shape.width` or `context.config.max_width()` for the max_width_error. Would love to get your thoughts on this.

### @ding-young
> Although it seems somewhat pointless to calling rewrite_result.ok() instead of rewrite, I did so since rewrite will return Result after all.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
