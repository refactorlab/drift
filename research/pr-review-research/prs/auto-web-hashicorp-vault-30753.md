# hashicorp/vault #30753 — PKI SCEP documentation updates

**[View PR on GitHub](https://github.com/hashicorp/vault/pull/30753)**

| | |
|---|---|
| **Author** | @stevendpclark |
| **Status** | Merged (June 6, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @victorr
> Reviewing with `request changes` as the nested bullet points need fixing. Also left many suggestions, please discard any of them that you don't agree with.

### @kitography
> This endpoint is used to authenticate against the SCEP auth method. It shouldn't be used directly, rather through delegated authentication from a PKI mount.

### @schavis
> (Proposed a "Before you start" section with requirements such as) You must have Vault Enterprise 1.20 or later (and) You must use the `static-challenge` authentication type to work with JAMF Pro.

### @schavis
> The following example uses SCEP with Intune authentication (recommending active voice instead of passive construction about what "is possible").

### @yhyakuna
> Left multiple review comments requesting clarification and consistency improvements across the SCEP configuration documentation sections.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
