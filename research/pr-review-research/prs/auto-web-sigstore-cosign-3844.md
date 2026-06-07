# sigstore/cosign #3844 — Upgrade to TUF v2 client

**[View PR on GitHub](https://github.com/sigstore/cosign/pull/3844)**

| | |
|---|---|
| **Author** | @cmurphy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @codysoyland
> I wonder if these filenames should be configurable somewhere for private Sigstore TUF operators. The existing metadata format allows for additional targets to be added and discovered, but TUF v2 does not allow iterating over targets, so that strategy is unsupported.

### @codysoyland
> The validity period in the TrustedRoot should be compared to the timestamp provided by the timestamping service or transparency log... I'm not sure we want to enforce this in this version of the code.

### @steiza
> We could make this pull request address those cases. But ultimately, we need #3844 and #3854 to agree on what the verification path should be when you're using TUF v2 - `sigstore-go` or `pkg/cosign/verify`.

### @jku
> How do we expect these to get set? By end users? It feels wrong if users need to set an environment variable to make the software use the recommended trust root mechanism.

### @steiza
> I don't know enough about `cosign` usage to know if we need to support signing in restricted network environments.

### @Hayden-IO
> It's also worth noting that Cosign may be used behind a firewall and even if signing requires a network connection, there may be a limited set of allowed domains for outbound traffic.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
