# spring-projects/spring-boot #49285 — Add more styling support to the Logback and Log4j2 color converters

**[View PR on GitHub](https://github.com/spring-projects/spring-boot/pull/49285)**

| | |
|---|---|
| **Author** | @mayankvirole |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wilkinsona
> Thanks for the PR, @mayankvirole, but this isn't quite what we're looking for. Phil described this in his comment on the issue: > we'll probably need updates to the converters so that multiple parameters can be passed to the converter. Currently you can only specify one, which gets converted into a single AnsiElement. I think we'll need to support several so that you can set forground/background/style in one hit.

### @wilkinsona
> I'd like to discuss this one with the rest of the team. With the support for styling (and not just foreground and background colours), the `ColorConverter` class names are no longer an ideal fit. Perhaps more importantly the `clr` keyword also doesn't fit quite so well.

### @wilkinsona
> We discussed this today and we're going to stick with the `Color…` class names and `clr` keyword as the primary purpose is still to change the text colour with the styling being additions on top of that.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
