# dagster-io/dagster #31796 — [docs] Revise tutorial

**[View PR on GitHub](https://github.com/dagster-io/dagster/pull/31796)**

| | |
|---|---|
| **Author** | @dehume |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @neverett
Suggested revising the tutorial description from "Learn how to build a pipeline with Dagster" to "Learn about Dagster basics, such as projects, assets, resources, asset dependencies, asset checks, automation, and components" to better reflect the breadth of content covered.

### @neverett
Writing clarity: proposed changing "showcase the power the Dagster" to "showcase the power of Dagster" and adjusting opening language from building "from the ground up" to emphasizing learning "core Dagster features" while building a working pipeline.

### @cnolanminich
Raised a technical concern about whether DuckDB's single-threaded nature would cause errors during concurrent execution, and suggested adding documentation about Dagster's concurrency controls to address this constraint.

### @neverett
> not doing this will result in an error

Noted that removing duplicate assets from configuration files warranted its own distinct tutorial section rather than being buried in an info box.

### @schrockn
Copyediting requests including clarifying "scaffold definitions from it" rather than "scaffold it" and adjusting summary language from "data platform" to more precisely "data pipeline."

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
