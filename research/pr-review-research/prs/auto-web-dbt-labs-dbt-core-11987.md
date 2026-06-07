# dbt-labs/dbt-core #11987 — update to latest jsonschemas

**[View PR on GitHub](https://github.com/dbt-labs/dbt-core/pull/11987)**

| | |
|---|---|
| **Author** | @MichelleArk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @QMalcolm
Approved the changes (no inline prose recorded in the rendered conversation thread).

### @MichelleArk (author self-review)
The substantive discussion on this PR is the author's own validation of the schema diff. She noted surprise that schemas changed from `"additionalProperties": false` to extensible patterns, then confirmed these are legitimate extensible schemas (meta, tblproperties, env_vars/macros, databricks_tags) and that `time_ingestion_partitioning` was correctly moved into the `TimeConfig` object.

*Note: this PR's conversation thread contains primarily bot comments, automated checks, and the author's self-review rather than substantive peer-review prose. Reviewer name and the nature of the discussion are captured above; no additional verbatim reviewer quotes were available on the page.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
