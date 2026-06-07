# openai/whisper #2451 — Fix: Update torch.load to use weights_only=True to prevent security warning

**[View PR on GitHub](https://github.com/openai/whisper/pull/2451)**

| | |
|---|---|
| **Author** | @yaslack |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bitplane
> For anyone else with this issue, I've been doing this for now: import functools whisper.torch.load = functools.partial(whisper.torch.load, weights_only=True)

### @hirehamir
> @jongwook this seems like a useful change that would reduce a lot of noise for developers. Are you open to it?

### @oscardssmith
> any updates here? this seems like an improvement that should be merged

### @jongwook
> #2301 was for the same issue but i didn't want to break compatibility with torch==1.10.1 just for this. The commit above should make it work for all version.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
