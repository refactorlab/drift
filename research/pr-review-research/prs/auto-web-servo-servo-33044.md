# servo/servo #33044 — Initial IndexedDB Support

**[View PR on GitHub](https://github.com/servo/servo/pull/33044)**

| | |
|---|---|
| **Author** | @arihant2math |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jdm
> The duplicate package results from `./mach tidy` can be addressed by updating the ignore list in servo-tidy.toml.

### @jdm
> Looks like `./mach test-unit` needs some compile fixes:

### @jdm
> this function takes 3 arguments but 2 arguments were supplied

(regarding `ResourceThreads::new()` now requiring an `IpcSender<IndexedDBThreadMsg>` parameter)

### @jdm
> I've gone ahead and fixed up the remaining build and test-tidy errors. Let's get this merged!

### @arihant2math
> Converting to draft as WPT is reporting too many errors

### @arihant2math
> Ok turns out that was because indexeddb was disabled, it should be good now

---

*Note: This PR has 203 hidden/collapsed conversation items plus resolved inline review threads that were not retrievable via plain web fetch (they require the GitHub JS UI / API to expand). The comments above are the substantive prose recoverable from the public HTML page; much of it is procedural (build/tidy/test fixes) rather than deep design debate, which lives in the collapsed threads.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
