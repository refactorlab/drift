# gohugoio/hugo #14610 — Add css.Build (using ESBuild to transform CSS resources)

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/14610)**

| | |
|---|---|
| **Author** | @bep |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmooring
> Can you please add `none` to the list of allowable values? In our docs it's easier to say 'Default is `none`' instead of something like 'Default is an empty string, which means don't create a source map.'

### @jmooring
> I'd be inclined to call the option 'target' to match the esbuild docs. Every option in our documentation will have a 'see details' link to the corresponding section in the esbuild docs; it would be nice if our option name matched theirs.

### @jmooring
> It would be great if users didn't run into errors like `Unexpected "\x89"`. I think we want a default map of loaders for common file formats.

### @jmooring
> Why do I have to do `@import "./components/a.css"` instead of `@import "components/a.css"`?

### @jmooring
> ESBuild tries to resolve 'bootstrap' via an `exports` map...it never reads the `style` field. It would be nice if `@import 'bootstrap'` just worked

### @bep
> I will add a `mainFields` option (default nil)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
