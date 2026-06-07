# siderolabs/talos #8901 — feat: support volume configuration, provisioning, etc.

**[View PR on GitHub](https://github.com/siderolabs/talos/pull/8901)**

| | |
|---|---|
| **Author** | @smira |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Unix4ever
> I wonder if we should log that some readonly disk got matched, but we skipped it.

### @Unix4ever
> My idea was that it might worth logging that the disk was skipped by provisioner as it's readonly to indicate the incorrect configuration.

### @frezbo
> oh this is way better 🆒

### @frezbo
> will we have a use case where the old wipe option on upgrade is needed 🤔 ?

### @smira
> I don't think so -- Omni runs with `--preserve` for more than a year now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
