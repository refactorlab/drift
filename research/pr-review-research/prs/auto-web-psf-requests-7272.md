# psf/requests #7272 — Add inline types to Requests

**[View PR on GitHub](https://github.com/psf/requests/pull/7272)**

| | |
|---|---|
| **Author** | @nateprewitt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cthoyt
> Annotating the kwargs with an `Unpack[KwargsDict]` where `KwargsDict` is a `typing.TypedDict` would be great! I hacked this into my own code...

### @nateprewitt
> This is a good callout...I played with Unpack for this but put that on pause because it got kind of messy...we're going to need several different TypedDicts.

### @cthoyt
> One thing worth noting is that you can have (multiple) inheritance on typed dicts. This can make it easier to factor out similarities...

### @srittau
> Some kwargs arguments could probably be accurately annotated using `Unpack[_SomeTypedDict]`...You could also consider marking constants as `Final`.

### @nateprewitt
> We're opting for alignment with existing types and discoverability over trying to convey HTTP semantics.

*Note: Several long review comments were truncated by the web summarizer; quoted fragments above are verbatim where shown (ellipses mark elision).*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
