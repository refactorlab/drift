# envoyproxy/envoy #32465 — new extension for TLS cert selection

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/32465)**

| | |
|---|---|
| **Author** | @doujiang24 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ggreenway
> I think we need to separate out the concepts of selecting certificates with custom logic, and fetching additional certificates... Having these two halves in separate PRs will make it easier to review.

### @ggreenway
> I can imagine cases where there are different wildcard certs available... The problem with coupling cert selection and the set of certs, is that if someone wants to only override cert selection behavior, they now need to also re-implement sourcing/loading certs.

### @ggreenway
> If you have a mechanism to just add SSL_CTX to the existing ContextImpl, what happens when an SDS response comes in an the ContextImpl is re-created and the old one is discarded? How will certs be removed if they're no longer used?

### @RyanTheOptimist
> Can you please flesh out the PR description and then we'll land with that as the commit message.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
