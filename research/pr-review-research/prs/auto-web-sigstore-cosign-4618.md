# sigstore/cosign #4618 — Sign exclusively via sigstore-go

**[View PR on GitHub](https://github.com/sigstore/cosign/pull/4618)**

| | |
|---|---|
| **Author** | @aaronlew02 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @steiza
> I'm using an empty signing config... I'm trying to sign with just a key, no PGI, and I get the immutable records notice (and I don't think that I should)

### @cmurphy
> This is looking great!... there's a small amount of duplicated code in the clients that might be worthwhile to move to signcommon.

### @Hayden-IO
> Exciting to see this coming together!... It's easy to see how we'll move forward with deprecating the older code paths now.

### @Hayden-IO
> Very happy with these changes!... We'll get this PR in asap so we can start working on the followups, we can hold off on merging any other changes in the meantime to avoid merge conflicts.

### @Hayden-IO
> For any more commits until this is merged, can you avoid force pushing? Without the commit hash from before the force push, I don't know what changed...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
