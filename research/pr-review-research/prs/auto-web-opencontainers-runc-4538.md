# opencontainers/runc #4538 — Linux Network Devices

**[View PR on GitHub](https://github.com/opencontainers/runc/pull/4538)**

| | |
|---|---|
| **Author** | @aojea |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kad
> LGTM. We are also interested in this use case for our accelerator devices.

### @lifubang
> If we only use the network namespace created by runc, this test will fail. I think maybe there is no such scenario, so we can let it to be implemented in the future if someone needs it.

### @rata
> I'll wait for @lifubang to comment on my question...I'll aim to merge tomorrow, unless @lifubang opposes.

### @kolyshkin
> Multiple technical review comments on validation and error handling across network device configuration files (specific line-by-line feedback on implementation details).

### @alexellis
> Provided infrastructure support debugging localhost resolution issues affecting CI tests on ARM64 runners.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
