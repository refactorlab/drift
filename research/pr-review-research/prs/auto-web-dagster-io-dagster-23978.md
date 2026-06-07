# dagster-io/dagster #23978 — deploying to kubernetes guide

**[View PR on GitHub](https://github.com/dagster-io/dagster/pull/23978)**

| | |
|---|---|
| **Author** | @jamiedemaria |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmsanders
> I think we should position this (and other OSS deployment) docs as reference/examples for how to run the Dagster-specific parts of a productionized Dagster deployment.

### @shalabhc
> I think we should just have users install their project directly using a `pip install ./iris_analysis` Instead of installing dependencies `dagster` and `pandas` explicitly.

### @shalabhc
On kubectl setup: users should have basic Kubernetes familiarity; instructions for Docker Desktop context creation were unnecessary and should defer to standard kubectl commands.

### @gibsondan
On gRPC configuration: the Helm chart handles running `dagster api grpc` commands, and users should understand they're configuring arguments for that server based on workspace file specifications.

### @PedramNavid
On scope clarification: the guide should teach what components comprise a Dagster deployment rather than claiming to teach full production system design, which requires decisions outside Dagster's scope.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
