# iced-rs/iced #2822 — More syntaxes for `iced_highlighter`

**[View PR on GitHub](https://github.com/iced-rs/iced/pull/2822)**

| | |
|---|---|
| **Author** | @Redhawk18 |
| **Status** | Merged (December 3, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hecrj
> The goal is to eventually get rid of the `iced_highlighter` themes altogether and use the built-in `Theme` directly to style each of the scopes.

### @hecrj
> I am not sold on `syntect` either. It feels like most of these Sublime Text syntax definitions are unnecessarily bloated.

### @hecrj
> I also think it's unfortunate that we need a new dependency for supporting basic syntaxes that should be built into `syntect` to begin with.

### @Redhawk18
> I can see where you're coming from, but how do we deal with code highlighting then? Maybe to some extent exposing syntect to pass in definition files?

### @hecrj
> I am not proposing any API changes, just pointing out that I am not sold on the current implementation details.

### @CosmicHorrorDev
> Got a couple of commit suggestions that you can cherry-pick if you want (provided refactoring improvements for theme handling).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
