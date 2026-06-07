# k3s-io/k3s #9340 — Readd `k3s secrets-encrypt rotate-keys` with correct support for KMSv2 GA

**[View PR on GitHub](https://github.com/k3s-io/k3s/pull/9340)**

| | |
|---|---|
| **Author** | @dereknola |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @brandond
> This is a docker caching optimization, as the `COPY ./tests ./tests` line will now be cached most of the time.

### @brandond
> Couple nits on comments/whitespace but LGTM otherwise

Note: This PR also drew several rounds of "requested changes" from @brandond on `token.go` (HTTP timeout handling / consolidating timeout options) and on `secretsencrypt/config.go` (configuration handling), plus an approval from @matttrach. Those inline review threads are lazy-loaded by GitHub's JavaScript and their verbatim text was not present in the static HTML retrieved via web fetch; only the timeline-level quotes above were directly extractable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
