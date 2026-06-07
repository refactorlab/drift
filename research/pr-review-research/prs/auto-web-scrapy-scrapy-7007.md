# scrapy/scrapy #7007 — Optimise `SitemapSpider` memory usage

**[View PR on GitHub](https://github.com/scrapy/scrapy/pull/7007)**

| | |
|---|---|
| **Author** | @albertedwardson |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @galloj
> Is there any reason why both start and end events are collected?

### @galloj
> The end event for the root tag should still be received...The main reason why the `start` tag should be avoided, is because it then leads to duplicate URLs

### @AdrianAtZyte
> Can you think of a way to modify the memory test...to make it do the opposite, i.e. pass only with lists but not with generators?

### @galloj
> Your example showed that it takes 5.24 MiB to store 2.86 MiB of text, which is 83% overhead. In my examples, the overhead of XML representation is 300% and 146%

### @AdrianAtZyte
> Don't we use a streaming parser that solves the XML parser issue with memory? And doesn't the body remain in memory until all URLs have been consumed by the caller anyway?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
