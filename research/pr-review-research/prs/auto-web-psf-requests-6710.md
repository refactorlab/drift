# psf/requests #6710 — Move _get_connection to get_connection_with_tls_context

**[View PR on GitHub](https://github.com/psf/requests/pull/6710)**

| | |
|---|---|
| **Author** | @nateprewitt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nateprewitt
> This PR is meant to provide a new publicly supported api `get_connection_with_tls_context` to better facilitate custom adapters with our recent fix for CVE-2024-35195... we will be deprecating the existing `get_connection` API, and custom adapters will need to migrate...

### @kdymov
> A small update about the minimum pass-through code for someone who will stumble upon this - don't forget to `return` the value, as you will face a different exception if you do

### @WhyNotHugo
> I'm having some issues upgrading to requests 2.32 which I think are related to this change... Do you have any guidance?

### @WhyNotHugo
> I'm also a bit confused by `get_connection_with_tls_context`, because it reads `Returns a urllib3 connection for the given request and TLS settings`, but no TLS settings are given.

### @nateprewitt
> You may be hitting a separate issue with `init_poolmanager`. We just released 2.32.3 to address that problem with custom adapters, you may want to give that a try.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
