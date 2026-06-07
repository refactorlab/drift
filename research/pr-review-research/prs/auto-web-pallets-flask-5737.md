# pallets/flask #5737 — Fix global CONTRIBUTING link

**[View PR on GitHub](https://github.com/pallets/flask/pull/5737)**

| | |
|---|---|
| **Author** | @strugee |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidism
> Please fix this using the named link syntax, inline links on large phrases are too hard to read/edit later.

### @davidism
> I think it might be switching from `<_contrib>` to `<contrib_>`? It looks like that in a few other places in the docs.

### @gmilde
> IMO, in this use case the anonymous link syntax is best suited... The _named_ hyperlink syntax makes only sense, if you want to (re-)use the reference name in a simple link somewhere else.

### @davidism
> I don't understand anonymous links, their documentation is lacking. How does this work if there are multiple links on a page? Also, occasionally we do reference the same link multiple times, so defaulting to that style makes more sense to me.

### @gmilde
> Mark, however, the difference between `detailed contributing documentation <contrib_>`_ and `detailed contributing documentation <contrib_>`__. The first variant registers the link text as 'reference name'.

### @davidism
> Ultimately, we're moving to myst-parser and Markdown, so this problem will go away.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
