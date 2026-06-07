# ibis-project/ibis #8917 — refactor(api): restrict arbitrary input nesting

**[View PR on GitHub](https://github.com/ibis-project/ibis/pull/8917)**

| | |
|---|---|
| **Author** | @kszucs |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cpcloud
> Why can't we keep t.select([t.foo], t.bar)? It doesn't seem meaningfully different from allowing t.select([t.foo], bar=t.bar)

### @jcrist
> The trick with doing this as a breaking change though is that previously working code may instead silently be treated as an array literal.

### @NickCrews
> t.bind(othertable) feels not obvious what is supposed to happen...Should we error if the two tables are different?

### @cpcloud
> Let's keep the full changeset here, and make sure to have both a `BREAKING CHANGE` bit as well as documentation on the behavior in the relevant APIs

### @NickCrews
> I have an inline comment above. Can someone fill me in on the context there a little more? I don't think this is a blocker for me.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
