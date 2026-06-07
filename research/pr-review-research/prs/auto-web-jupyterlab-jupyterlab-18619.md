# jupyterlab/jupyterlab #18619 — Improve focus indicators

**[View PR on GitHub](https://github.com/jupyterlab/jupyterlab/pull/18619)**

| | |
|---|---|
| **Author** | @IsabelParedes |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @krassowski
> the outline around active cell seems a bit much. I am not convinced whether we should aim to meet the letter of the AAA recommendation on Focus Appearance (2px thick perimeter) because we already have a large focus indicator bar in the cell.

### @IsabelParedes
> With a 1px outline, the focus indicator area (area of the perimeter + area of the indicator bar) meets the requirements when the cell is sufficiently long (roughly less than half the width).

### @krassowski
> This change (removal of `--jp-search-toggle-off-opacity` and friends, addition of `--jp-focus-outline-color` and friends), should be documented in Extension Migration Guide - we should have a section for theme authors.

### @krassowski
> Ah, this used the old snapshots because the merge step on CI did not start running yet. I will need to detect if there is any run in progress better.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
