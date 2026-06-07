# hashicorp/terraform #36872 — Added Terraform backend implementation for OCI Object Storage

**[View PR on GitHub](https://github.com/hashicorp/terraform/pull/36872)**

| | |
|---|---|
| **Author** | @ravinitp |
| **Status** | Merged (April 22, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SarahFrench
> Could you please let us know when this PR is ready for review, and mark the PR as draft until then? Force pushes to this branch make it hard for us to identify what code has changed since the last time we took a look.

### @radeksimko
> Can you please run `make syncdeps`?

### @radeksimko
> I originally thought the dependency change in the `consul` backend was unrelated to this PR but it is. I assume the `objx` library is a shared transitive dependency and as a result of OCI being added, it impacts consul's `go.sum`.

### @crw
> (On naming) the team would continue to use the un-prefixed nomenclature for this backend, since the Oracle provider already uses the `oci` naming convention.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
