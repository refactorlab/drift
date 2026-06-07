# rust-lang/rfcs #3681 — [RFC] Default field values

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3681)**

| | |
|---|---|
| **Author** | @estebank |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @scottmcm
> I'm not sure we should call this FRU, since there's no base object... I think it's useful if the RFC draws parallel to the FRU syntax whenever possible, to avoid needing to re-explain things.

### @scottmcm
> One drawback that comes to mind is that it'll mean that a pattern `Foo { .. }` can match more things than just the _expression_ `Foo { .. }`, because the pattern matches _any_ value of the unmentioned fields, but the expression sets them to a particular value.

### @tmandry
> I would like to see a section on differences from FRU (especially the interaction with privacy and `#[non_exhaustive]`)... undoing past mistakes by adding more features without fixing the features we have leads to an uneven and complex language surface.

### @scottmcm
> The problem with FRU is all about it not having the desugaring that lots of people expect... The problem is that what it does is secretly duplicate private fields on a type, which is blatantly wrong.

### @programmerjake
> I think requiring `Default` is unnecessarily limiting, since it would prevent using the nice new syntax with structs where some fields have defaults and others intentionally do not.

### @RalfJung
> Indeed, and that's a downside -- it mirrors the syntax but has different semantics. The text here makes it sound like that's a good thing; I think that should be reworded.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
