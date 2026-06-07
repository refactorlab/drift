# scrapy/scrapy #6608 — Flexible severity of logging level when items are dropped

**[View PR on GitHub](https://github.com/scrapy/scrapy/pull/6608)**

| | |
|---|---|
| **Author** | @protokoul |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Gallaecio
> This approach is problematic, spider-specific settings (e.g. from `Spider.custom_settings`) would not be taken into account. I think we need to move the logic to read the setting to the code that captures the exception...

### @Gallaecio
> Should we call it `log_level`, in line with the setting?

### @Gallaecio
> We can make it the expectation for it to be numerical, and it makes sense... But then I think we need to enforce through type hints that the value of the exception must also be of that type...

### @Gallaecio
> I would not bother validating or making it uppercase. If the value is invalid, Python will raise some exception. What we need to make sure is that we do not make it invalid.

### @wRAR
> Please also note that you have unrelated commits here

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
