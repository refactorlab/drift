# tower-rs/tower #828 — fix: use minimal tokio features in `make` and `reconnect` features

**[View PR on GitHub](https://github.com/tower-rs/tower/pull/828)**

| | |
|---|---|
| **Author** | @Icemic |
| **Status** | Merged (June 30, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jplatte
> You only partially implemented my suggestions. Here is what I meant: (followed by specific code changes removing the `tokio` dependency from the `reconnect` feature and the `sync` feature from tokio's globally enabled options)

### @Icemic
> Done but I'm not sure if it is ok to remove `sync` from default enabled features of tokio for all cases. CI works fine however.

### @jplatte
> Thanks! I just realized this isn't merged yet. Not sure what happened there. GitHub is telling me there's merge conflicts and I can't resolve them myself because I'm not allowed to push to your branch. Mind rebasing or merging our `main` back into your branch?

### @Icemic
> Sure!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
