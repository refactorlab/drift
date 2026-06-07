# actix/actix-web #3526 — Fix continuous integration

**[View PR on GitHub](https://github.com/actix/actix-web/pull/3526)**

| | |
|---|---|
| **Author** | @joelwurtz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @robjtede
> installing nightly rust is done above if the version needs bumping i can do that in the repo variables settings

### @robjtede
> for msrv compat points, this is the technique which allows testing with newer versions on stable and older versions on msrv

### @robjtede
> Anyone with collaborator access to the repositories with access to a secret or variable can use it for Actions. They are not passed to workflows that are triggered by a pull request from a fork.

### @joelwurtz
> It seems that cargo public api requires `nightly-2024-10-18`, i removed this then since it's only a setting update

### @joelwurtz
> Hum, it's strange, it seems to install stable version on every PR since #3501 var seems to be empty, maybe as user we don't have access to this variable

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
