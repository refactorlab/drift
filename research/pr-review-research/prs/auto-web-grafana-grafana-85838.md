# grafana/grafana #85838 — Gops: Add configuration tracker on the existing IRM page

**[View PR on GitHub](https://github.com/grafana/grafana/pull/85838)**

| | |
|---|---|
| **Author** | @soniaAguilarPeiron |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gillesdemey
> Perhaps it would be more efficient to simply check if we have at least one rule from the prometheus endpoint for Grafana-managed, we can limit the response size

### @soniaAguilarPeiron
> I started using prometheus endpoint (without the LIMIT), and @konrad147 suggested me to switch to ruler api as its faster

### @konrad147
> Made multiple technical review comments regarding code organization and implementation details across hooks and configuration handling (comments marked as resolved during review process).

### @tomratcliffe
> Reviewed changes to API integration, specifically the RTKQ implementation for incidents handling.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
