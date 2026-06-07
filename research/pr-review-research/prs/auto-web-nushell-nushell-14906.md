# nushell/nushell #14906 — Custom command attributes

**[View PR on GitHub](https://github.com/nushell/nushell/pull/14906)**

| | |
|---|---|
| **Author** | @Bahex |
| **Status** | Merged (February 11, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kubouch
> I'm not sure how I feel about the attributes defined as command calls, it seems to me like an unnecessary complication... it's easier to misuse because people could start putting all sorts of complex code into it even though attributes are meant to just provide simple static markup

### @kubouch
> Let's scale down the scope of this PR to a pre-defined set of attributes: env, example, wrapped, search terms and test. The current implementation using `attr` would stay, but it would be more of an implementation detail that we don't need to advertise

### @fdncred
> I think the proposed solution currently in this PR is easier to grok... The current status of `@example string closure --result` is pretty easy to wrap your head around without wondering which example goes where

### @132ikl
> I also don't really like the `attr` prefix. There was discussion of adding a built-in `@attr` attribute, so you could do like... It would be nice if attribute commands could somehow only be used as attributes, then we can avoid the `attr` prefix without shadowing commands

### @Bahex
> With the prefix, attribute commands can be invoked as normal commands, I find that useful because attribute commands can have help text and examples of their own which can be obtained like `attr example -h`

### @fdncred
> Dang, it looks like we forgot `@category` so we can add a category to custom commands. Or maybe I'm just missing something?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
