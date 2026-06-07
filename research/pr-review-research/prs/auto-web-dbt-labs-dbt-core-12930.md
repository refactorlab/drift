# dbt-labs/dbt-core #12930 — feat: catalogs.yml v2 with adapter-owned bridge architecture

**[View PR on GitHub](https://github.com/dbt-labs/dbt-core/pull/12930)**

| | |
|---|---|
| **Author** | @aahel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @colin-rogers-dbt
> Generally looks good, when the change to base adapters lands we should bump the pyproject.toml here so that core requires the version of dbt-adapters that adds the capability

### @colin-rogers-dbt
> I think it's to keep, not sure it should be a 'warning' but maybe a debug/info log

### @colin-rogers-dbt
> if we want to be super defensive here we should check that `bridge_v2_catalog` is present on the adapter and gracefully handle that but maybe that handling should happen on the base adapter?

### @Copilot
> If adapter registration isn't strictly idempotent, this could have side effects; even if it is, it's extra work. Consider refactoring so the adapter is registered only once

### @aahel (author response)
> Without this, _cat_v2 is None, the old guard was skipped, and bridge_v2_catalog caused an AttributeError. Now: missing capability raises a friendly DbtProjectError

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
