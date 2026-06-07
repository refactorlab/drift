# argoproj/argo-cd #25371 — feat(source-integrity): Implement Source Integrity checking

**[View PR on GitHub](https://github.com/argoproj/argo-cd/pull/25371)**

| | |
|---|---|
| **Author** | @olivergondza |
| **Status** | Merged (May 7, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @blakepettersson
> This maintains the manifest API functionality...but it is interpreting it using the new implementation (no duplicated code, some regression risk)

### @blakepettersson
Requested clarification on how the new mechanism maintains compatibility with existing GPG signing keys management while marking the old approach as deprecated.

### @crenshaw-dev
Requested restoration of backward compatibility for API elements including `ManifestResponse.verifyResult`, `RepoServerRevisionMetadataRequest.checkSignature`, and related fields to prevent breaking changes.

### @blakepettersson
> LGTM once the checks have been fixed. Thanks!

### @anandf
Suggested improvements to upgrade documentation to clarify migration path from legacy GPG approach to the new Source Integrity mechanism.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
