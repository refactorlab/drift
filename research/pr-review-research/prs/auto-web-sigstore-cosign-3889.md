# sigstore/cosign #3889 — Add support for new bundle specification for attesting/verifying OCI image attestations

**[View PR on GitHub](https://github.com/sigstore/cosign/pull/3889)**

| | |
|---|---|
| **Author** | @codysoyland |
| **Status** | Merged (Mar 14, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cmurphy
> If they haven't set `--trusted-root` then they could be using other flags or relying on the TUF v1 setup which might be pointed to something other than the public good instance.

### @cmurphy
> Could you clarify why it's okay for only one bundle to be verified?

### @Hayden-IO
> Do we _want_ to support multiple bundles on a single container? We shouldn't be bound to Cosign's previous decisions and it might be worth revisiting this now.

### @bkabrda
> Verifying attestation with the cert identity+OIDC issuer segfaults when there is also an existing attestation created using a private key.

### @steiza
> Do I understand the Codecov report correctly that 1% of these changes are covered via tests? Any thoughts on how to increase that?

### @Hayden-IO
> To check, is this not an issue that the OCI struct is missing additional verification data because we already have a bundle?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
