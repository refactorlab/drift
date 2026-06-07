# tokio-rs/axum #2654 — Add multipart/form-data response builders to axum-extra

**[View PR on GitHub](https://github.com/tokio-rs/axum/pull/2654)**

| | |
|---|---|
| **Author** | @zleyyij |
| **Status** | Merged (September 28, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mladedav
> Thanks, for the PR I think the functionality looks good. I have not personally worked with multipart on this level so I don't know much of the technical details but I did comment on some of the other stuff.

### @jplatte
> No, it's just waiting on my review. I've started looking at it now.

### @jplatte
> I don't have the energy to do another review, but I think this has seen enough attention that we should just merge it by now. There's just some doc comment rewrapping I wanna apply before merging (can likely commit it myself).

### @zleyyij
> I gave up and just made any mime parsing happen internally, and the associated functions return an error. I ran as much CI as I could with `act` locally, hopefully it passes

### @jplatte
> Do you want this to be released in another axum-extr 0.9.x patch release? It's not a huge effort but if you don't care, I'll let it sit until I have another reason to make a patch release, or it's time for 0.10.0.

### @zleyyij
> Ok, I managed to fix all of those CI errors, thank you for your patience

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
