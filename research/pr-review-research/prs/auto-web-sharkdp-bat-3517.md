# sharkdp/bat #3517 — Improve native man pages and command help syntax highlighting by stripping overstriking

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3517)**

| | |
|---|---|
| **Author** | @akirk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @keith-hall
> If we do decide to merge this, probably we would no longer need the complicated `MANPAGER` advice in the readme? CC @eth-p as our expert on man pages... I think it could benefit from some integration tests for content containing overstrike.

### @keith-hall
> I wonder how necessary it is on other inputs apart from the manpages. I guess it shouldn't cause any confusing output when syntax highlighting is enabled, so maybe this approach is fine

### @akirk
> Indeed, my thinking was that overstriking will interfere with any (ansi) syntax highlighting... But on the other hand, it feels more robust to enable it only for man pages and command help.

### @eth-p
> If ANSI escape sequence and overstriking are both automatically stripped from the input, I would say yeah, we should also remove the link to `batman`... It doesn't provide any benefit if `bat` can do that out of the box.

### @keith-hall
> Does `--strip-ansi` help @danrneal? [in response to rendering issues reported]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
