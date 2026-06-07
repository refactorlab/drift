# pypa/pip #13048 — Add trusted publisher release workflow

**[View PR on GitHub](https://github.com/pypa/pip/pull/13048)**

| | |
|---|---|
| **Author** | @sbidoul |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ichard26
> Are we going to include any deployment protection rules for the release environment? I realize that means requiring a second person to briefly review any release deployments, but that seems prudent given the rise of supply-chain attacks.

### @pfmoore
> Adding a review to that process would introduce a delay where I'd need someone else to be available...I keep track of the release in my head, which is fine as it's a single piece of work with no interruptions.

### @webknjaz
> it is possible to disallow self-approvals in the environment protections...setting up required reviews with just 1 reviewer required and self-reviews allowed would let you have just enough control.

### @sethmlarson
> Pin all the action steps to commit SHAs instead of git tags to avoid a source of immutability. You can use frizbee to do this for you if you'd like.

### @pradyunsg
> the attack vectors to succeed with a pip release have changed...Whether this is worse or better than before, I can't tell.

### @potiuk
> do the reproducible build in controlled environment (container image...to battle all environmental issues and give easy instructions for someone who wants to verify.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
