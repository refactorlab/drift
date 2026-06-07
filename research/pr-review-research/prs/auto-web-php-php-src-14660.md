# php/php-src #14660 — ext/bcmath: Optimize `bcdiv` processing

**[View PR on GitHub](https://github.com/php/php-src/pull/14660)**

| | |
|---|---|
| **Author** | @SakiTakamachi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ndossche
> I couldn't quite follow bc_standard_div and am waiting for clarifications on that.

### @ndossche
> What are the similarities and differences / advantages and disadvantages of your algorithm vs the previously implemented algorithm?

### @Girgias
> The other thing, which I would like to know, is how much of an impact in performance do the repeated restores actual cause.

### @ndossche
> I suppose you mean `(n1_high * B^k) / (n2_high * B^k)`

### @Girgias
> Feels like it conveys the same meaning, just way more succinctly

### @ndossche
> I think this is right, or at least I don't see anything wrong and some stress testing doesn't reveal issues.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
