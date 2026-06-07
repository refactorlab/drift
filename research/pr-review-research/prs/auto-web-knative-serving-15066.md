# knative/serving #15066 — Integrate net-certmanager in Serving

**[View PR on GitHub](https://github.com/knative/serving/pull/15066)**

| | |
|---|---|
| **Author** | @skonto |
| **Status** | Merged (April 25, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ReToCode
> Can we have a second method in sharedmain where we pass a function to do... to avoid duplicating code here?

### @ReToCode
> can we use a different file name? It is no longer `net-xxx`. Maybe just `certmanager.yaml`?

### @dprotaso
> Let's use `certmanager.yaml` as the name here - that's the convention we use for other config maps

### @ReToCode
> can `netCfg.NamespaceWildcardCertSelector != nil` be used without `netCfg.ExternalDomainTLS == true`?

### @dprotaso
> reviewdog is having issues grabbing the PR diff because it's so big. GitHub broke something :/

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
