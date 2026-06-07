# BurntSushi/ripgrep #3420 — ignore: scope compiled parent matchers by root

**[View PR on GitHub](https://github.com/BurntSushi/ripgrep/pull/3420)**

| | |
|---|---|
| **Author** | @jelle-openai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MichaReiser
> I'm not very familiar with this code base, but this makes me wonder if it's still worth caching here... The caching here also served two purposes: Avoid parsing the same ignore files multiple times [and] Deduplicate errors.

### @BurntSushi
> Yeah I think @MichaReiser is right here. In particular, I think this solution will fall apart when there are a lot of roots.

### @MichaReiser
> This comment here is now misplaced

### @BurntSushi
> I find this quite promising! [after sharing benchmark results showing the final solution performs well across multiple commits]

### @MichaReiser
> I reworded the commits. I also had codex write a few benchmarks and verified that none of them regress (beyond noise).

### @BurntSushi
> I love the fix! Rather elegant. Thank you @jelle-openai and @MichaReiser for getting this over the finish line.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
