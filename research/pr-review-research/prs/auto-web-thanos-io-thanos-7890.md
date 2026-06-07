# thanos-io/thanos #7890 — query, rule: make endpoint discovery dynamically reloadable

**[View PR on GitHub](https://github.com/thanos-io/thanos/pull/7890)**

| | |
|---|---|
| **Author** | @MichaHoffmann |
| **Status** | Merged (January 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alelevinas
> I think the documentation still needs to be modified here. The very first example under the 'Query' component is now supposedly using a deprecated flag, which one should users use?

### @SB-MFJ
> With the `--store` flag deprecation, how do I specify DNS SD?

### @MichaHoffmann
> You can use --endpoint or add an endpoint with '-address: dnssrv+...' In the endpoint SD file

### @alelevinas
> Isn't this PR adding a deprecation notice for `--endpoint` as well?

### @GiedriusS
> Two minor nits but otherwise LGTM

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
