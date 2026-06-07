# gohugoio/hugo #14094 — markup/asciidocext: Improve Asciidoctor integration

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/14094)**

| | |
|---|---|
| **Author** | @jmooring |
| **Status** | Merged (by bep on Nov 24, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmooring
> I'm not thrilled about the duration of the integration test (it's the second largest contributor to overall test time), but I don't want to pare it down either.

### @jmooring
> Integration test will only run when `IsRealCI` is true, and then only for three of the sub-tests

### @bep
> We have had 'space issues' before, which is the reason we currently do not run on Darwin

### @jmooring
> When using GoAT diagrams, the benefit is less noticeable because generation is very fast

### @bep
> (Requested changes on test file organization; threads marked resolved but full prose did not render within the fetch budget.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
