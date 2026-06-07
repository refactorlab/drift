# rust-lang/rustfmt #6247 — implement Style Edition support

**[View PR on GitHub](https://github.com/rust-lang/rustfmt/pull/6247)**

| | |
|---|---|
| **Author** | @calebcartwright |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ytmimi
> I would also expect that `rustfmt --print-config default` would output `style_edition="2015"` and `version="One"`, though, I'd expect that if I ran `rustfmt --style-edition 2024 --print-config default`...I'd get output that reflected the defaults for style edition 2024.

### @ytmimi
> I think we should add a set of unit tests that validate the config loading rules by calling `load_config` directly instead of the...tests. That way we can test out various scenarios like what happens when you specify `style_edition` in your rustfmt.toml, but also pass it as `--config=style_edition`.

### @ytmimi
> I'm not trying to suggest that we hard deprecate `version` in this PR...I actually wasn't expecting to transition from `version` -> `style-edition` at all in this PR.

### @calebcartwright
> This PR does nothing more and nothing less than expose `style_edition` to users...Any changes to those behaviors and any extensions to those behaviors are outside the scope of this PR.

### @ytmimi
> I could see this being a subtle bug when the next edition comes out. Probably makes sense to change this to...`OverflowableItem::MacroArg(..) if config.style_edition >= StyleEdition::Edition2024`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
