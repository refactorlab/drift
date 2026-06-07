# actix/actix-web #3560 — implement Responder for Result<(), E: Error>

**[View PR on GitHub](https://github.com/actix/actix-web/pull/3560)**

| | |
|---|---|
| **Author** | @axos88 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @robjtede
> I still think implementing for `()` at all is too opinionated. I can forsee us getting issues opened about why `Some(())` is 204 and not 200 for example.

### @robjtede
> I feel that pushing users of Actix Web towards explicitly understandable return values is good thing.

### @axos88
> Why would you assume its a 200? 204 exactly means no content, which is what the unit type is - something with no content.

### @robjtede
> After thinking about this, it's easy enough to just give the reasoning if it comes up. Pushing folks towards the correct response for empty content seems like a good change.

### @robjtede
> The Option impl is more questionable though due to the None variant. I'll think about it more.

### @robjtede
> Yea I think I'd like to progress without the `Option<()>` impl for now. It does seem very weird to use as a `Responder`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
