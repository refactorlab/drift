# radix-ui/primitives #2934 — React 19 compatibility

**[View PR on GitHub](https://github.com/radix-ui/primitives/pull/2934)**

| | |
|---|---|
| **Author** | @vladmoroz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lucasmotta
> I wonder what's the future of the Slot component as React considers `cloneElement` a `legacy api`. 🤔

### @vladmoroz
> We'll see—I haven't seen a good alternative there, and 'legacy' doesn't mean it's deprecated yet. I think it will stay around for a while.

### @lucasmotta
> Should we extract this to a utility and reuse in other places instead of having the duplicated code?

### @vladmoroz
> Would have to be a separate package—I'd say we keep it like this for now and extract it later if there's 3+ uses. I think two copy-pastes is OK for now.

### @oliviertassinari
> It looks like we could save bundle size here. How about going with `React.version.split('.')[0] >= '19'` for this method?

### @vladmoroz
> Prop types have been deprecated for a while and are now completely removed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
