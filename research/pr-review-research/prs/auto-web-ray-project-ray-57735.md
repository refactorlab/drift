# ray-project/ray #57735 — [Core] Introduce node specific temp-dir specification

**[View PR on GitHub](https://github.com/ray-project/ray/pull/57735)**

| | |
|---|---|
| **Author** | @Kunchd |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MengjinYan
> Should be marked as `DeveloperAPI`

### @MengjinYan
> `get_all_node_info()` is a very expensive call. Is it possible to filter by node id when making the call?

### @MengjinYan
> I think we should call the `get_default_ray_temp_dir()` here instead of duplicate the logic

### @jjyao
> Our gcs client is already retryable so we don't need to implement retry here. We can just set a total timeout

### @jjyao
> The previous `_setup_logging` also calls `_get_log_dir()` we should cache the result

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
