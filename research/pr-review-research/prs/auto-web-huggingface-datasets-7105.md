# huggingface/datasets #7105 — Use `huggingface_hub` cache

**[View PR on GitHub](https://github.com/huggingface/datasets/pull/7105)**

| | |
|---|---|
| **Author** | @lhoestq |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Wauplin
> Better to use `huggingface_hub.utils.get_session().head(...)` to make HTTP requests instead of `requests.head`. It's a helper to return a unique session which keeps the connection open (quicker when consecutive calls) + check `HF_HUB_OFFLINE` automatically + adds a request_id header to help debug things.

### @Wauplin
> This is already the default value in `huggingface_hub` (parsed from the same environment variable)

### @lhoestq
> `dataset-viewer` does it in its tests to switch between prod and testing endpoints :p

### @Wauplin
> ok ok, maybe a topic for a separate PR then. It still feels wrong to me to handle endpoints in various places (both in `huggingface_hub` and in `datasets`)

### @Wauplin
> Thanks for working on this! 🎉 🎉 🎉 I did a first pass and left a few minor comments. Looks good!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
