# spf13/cobra #2173 — Make detection for test-binary more universal

**[View PR on GitHub](https://github.com/spf13/cobra/pull/2173)**

| | |
|---|---|
| **Author** | @thaJeztah |
| **Status** | Merged (later reverted in v1.9.1) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @marckhouzam
> I'm trying to reproduce the issue by removing this `cobra.test` check but haven't been able to. Could you point me to a way to reproduce this issue so that I can see your PR at work?

### @thaJeztah
> IIRC this happened either when the test was pre-compiled and run, but also in some cases when running tests from my IDE

### @marckhouzam
> Aha, I see. So the `-test.*` flags get ignored properly, but the flag values remain and become arguments to the cobra command.

### @marckhouzam
> This is causing some unit tests to fail from some projects using Cobra. It turns out that the better detection of a test-binary is preventing those projects from setting `os.Args` in their test

### @thaJeztah
> I'd not be _horribly_ upset if it was reverted; it was really a small quality-of-life improvement

### @marckhouzam
> I'm leaning toward reverting this PR

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
