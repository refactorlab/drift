# ratatui-org/ratatui #1089 — fix: unicode truncation bug

**[View PR on GitHub](https://github.com/ratatui-org/ratatui/pull/1089)**

| | |
|---|---|
| **Author** | @joshka |
| **Status** | Merged (May 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @EdJoPaTo
> Added heavily inspired by unicode-truncate code to find the index in order to get the starting index. This allows for taking a reference rather than cloning into an ever-more-allocating String.

### @EdJoPaTo
> The logic is somewhat horribly complex as a lot of stuff isn't intuitive… The widths are usize and not u16 as the truncation of the end is implicitly done.

### @EdJoPaTo
> Even an improvement of 12% is really good here already. The benchmark goes to a regression of 36%. So this is definitely significant. For the default of left alignment which is the most often used one.

### @joshka
> Let's look at the absolute magnitude of the change though: (10 * .125) = 1.25us per call... rarely directly noticeable.

### @kdheepak
> The code is very readable and merging this even with bugs is good to me! I like that there are tests that capture the behavior.

### @EdJoPaTo
> It somewhat worries me that new test cases pop up and break stuff even when we thought we are done and only need documentation stuff.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
