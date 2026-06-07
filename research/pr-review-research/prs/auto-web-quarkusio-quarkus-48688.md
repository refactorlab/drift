# quarkusio/quarkus #48688 — Extension Structure ADR proposal

**[View PR on GitHub](https://github.com/quarkusio/quarkus/pull/48688)**

| | |
|---|---|
| **Author** | @cescoffier |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dmlloyd
> The package name and module name must match except for only very special situations...What if we call the API JPMS module `io.<quarkus|quarkiverse>.<extension-name>.api` and the runtime JPMS module `io.<quarkus|quarkiverse>.<extension-name>.runtime`, with package names that match?

### @Ladicek
> SPI is part of API. API is what users are supposed to use...An attempt to separate the two into different modules is an exercise in futility.

### @gsmet
> For me, nothing in the deployment should be API. It's SPI.

### @yrodiere
> Can we consider renaming 'deployment' to 'build'? I understand the module is about 'preparing a deployment', but this is super confusing to new contributors/users.

### @cescoffier
> The idea was to split the ADR proposal into two parts...Another ADR studying the possibility of switching from deployment to build-xyz and potentially doing that for Quarkus 4.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
