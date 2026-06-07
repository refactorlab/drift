# go-chi/chi #919 — Avoid possible memory leak in compress middleware

**[View PR on GitHub](https://github.com/go-chi/chi/pull/919)**

| | |
|---|---|
| **Author** | @Neurostep |
| **Status** | Merged (later reverted in #924 due to regression #923) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @VojtechVitek
> LGTM. Thanks for the detailed report and additional test cases. Really nice work!

### @VojtechVitek
> can you `go get github.com/go-chi/chi/v5@latest` and report back if the issues is gone in `master` branch, please?

### @Neurostep
> We have deployed the `latest` version of the `go-chi/chi` to our production version of the service and we are no longer seeing the memory leak.

### @adrian-bl
> Using the compression middleware, i get 'extra bytes' at the end of the document

### @VojtechVitek
> Reverting in #924 due to #923. I wonder if someone could figure out the reason and write additional test cases

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
