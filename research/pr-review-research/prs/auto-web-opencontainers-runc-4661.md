# opencontainers/runc #4661 — skip setup signal notifier for detached container

**[View PR on GitHub](https://github.com/opencontainers/runc/pull/4661)**

| | |
|---|---|
| **Author** | @lifubang |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kolyshkin
> Yeah, it's weird. We set up signal forwarding (for create/run/exec) and then we don't use it... I can't review it because the current code makes no sense to me

### @rata
> it feels like several different things are changed here. If you can separate your patches... it will greatly simplify review.

### @kolyshkin
> It might result in a better code if we add one more patch in the middle... to disambiguate the use of `err`.

### @rata
> I think I found a bug, though... If something is not enough to split in a different commit, then a mention in the commit message is very helpful.

### @rata
> The commit split is definitely helping... I'm not a fan of the 4th commit, I think it's still a little tricky and the destroy on defer feels weird.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
