# grafana/loki #14517 — docs: Deploy Loki Helm on AWS guide

**[View PR on GitHub](https://github.com/grafana/loki/pull/14517)**

| | |
|---|---|
| **Author** | @Jayclifford345 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JStickler
> After an internal discussion, it was decided to focus deployment guides for helm on either Monolithic or microservice. The Loki team felt more comfortable supporting both of these deployment styles since its closer to what we deploy internally.

### @Jayclifford345
> We leave the object storage type as s3 even when using MinIO since it is S3-compatible storage.

### @Jayclifford345
> I added a section around creating authentication for Canary I didn't notice that this also requires authentication when you use a username and password for Loki.

### @JStickler
> [docs team] LGTM

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
