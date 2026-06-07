# facebook/react-native #53980 — Allow extending ReactTextViewManager again

**[View PR on GitHub](https://github.com/facebook/react-native/pull/53980)**

| | |
|---|---|
| **Author** | @janicduplessis |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cortinico
> This class is going to be deleted in 0.83+ and beyond so I'd suggest we don't make it open. Instead this shadow node should probably be copied over and maintained by the library

### @cortinico
> Inheritance makes our code extremely hard to evolve, as every change to a class results in a breaking change. Ideally the 3p library should use composition to model their behavior

### @janicduplessis
> I currently believe merging this only in 0.81 branch could be the best solution, since it will allow to keep old arch support, and for next release targeting 0.82 or 0.83 we can drop old arch and move to a delegate technique.

### @cortinico
> yeah that's probably a reasonable alternative then

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
