# moby/moby #47041 — Refactor 'resolv.conf' generation

**[View PR on GitHub](https://github.com/moby/moby/pull/47041)**

| | |
|---|---|
| **Author** | @robmry |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @corhere
> We have a perfect opportunity to put the new `ResolvConf` and related code into an `internal` package, which would free us from any compatibility promises.

### @corhere
> Code that is not sandbox_dns_unix may have no need for writing a digest...It may not even want to write the generated resolv.conf to disk at all!

### @corhere
> I'd really like to refactor stringly-typed IP addresses out of libnetwork. I figure we can accomplish this iteratively by writing new code to accept only pre-parsed addresses.

### @corhere
> Iterative string concatenation is O(n^2). Why not make `other` a `[]string` and concatenate when rendering the template?

### @corhere
> Things could go very wrong if an unsuspecting developer tried to run the integration suite outside of a container...could you add a sanity check?

### @corhere
> The package doc comment is externally visible! Documenting implementation details makes them part of the API contract!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
