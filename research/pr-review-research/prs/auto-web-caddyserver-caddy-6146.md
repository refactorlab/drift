# caddyserver/caddy #6146 — autohttps: Implement `auto_https prefer_wildcard` option

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6146)**

| | |
|---|---|
| **Author** | @francislavoie |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mholt
> I'm actually intending to make this the default in the next version of Caddy, so it might be removed.

### @mholt
> There's another aspect I want to consider as well, that is some users want just specific domains to be served under a wildcard, while the others shouldn't be.

### @kanashimia
> If Caddy fails to obtain cert for *.example.com then foo.example.com won't have any cert too right?

### @coandco
> When I try to define multiple wildcard domains, it fails with `no solvers available for remaining challenges`...the DNS solver info didn't make it in.

### @drglove
> As a result, I've observed that even with `auto_https prefer_wildcard` being set, a certificate is being requested unexpectedly for `bar.testdomain.com`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
