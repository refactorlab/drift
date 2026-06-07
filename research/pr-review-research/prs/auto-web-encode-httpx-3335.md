# encode/httpx #3335 — Drop overloaded usage of 'verify' and 'cert'

**[View PR on GitHub](https://github.com/encode/httpx/pull/3335)**

| | |
|---|---|
| **Author** | @lovelydinosaur |
| **Status** | Merged (October 10, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @T-256
> Why don't we want these anymore?

(Questioning the removal of `post_handshake_auth` and `hostname_checks_common_name` settings from the SSLContext setup.)

### @lovelydinosaur
> Using commonName fallback has been deprecated for some time... This is not enforced in ssl.create_default_context(), and perhaps we don't need to either

### @T-256
> Do we need to document sys.flags.ignore_environment behavior at here?

### @lovelydinosaur
> Maybe. We're just following stdlib behavior here. Can take a final review on that once we've dealt with getting the API clean-up in.

### @T-256
> LGTM, thanks for the clarification.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
