# alacritty/alacritty #8627 — windows: Properly escape command line arguments

**[View PR on GitHub](https://github.com/alacritty/alacritty/pull/8627)**

| | |
|---|---|
| **Author** | @feeiyu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @chrisduerr
> Have you looked at #3857 and its outstanding questions?

### @chrisduerr
> My issue is with having an option at all. If it requires manual user intervention and figuring things out anyway, why isn't the current solution sufficient?

### @chrisduerr
> You mean so you can do whatever you want in Zed? I'm fine with that, yes.

### @chrisduerr
> I believe we have a CHANGELOG.md in `alacritty_terminal`, could you add the new API there so other consumers interested in this functionality can be made aware of it?

### @kchibisov
> Maybe this should be a free function instead, so if the backend feels like it can call it on the args that it passes forward?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
