# rclone/rclone #8886 — backend: Add Huawei Drive support

**[View PR on GitHub](https://github.com/rclone/rclone/pull/8886)**

| | |
|---|---|
| **Author** | @sanchuanhehe |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ncw
> I pulled this locally to give it a test against a new Huawei Drive account...I found that this backend test isn't working any more - can you fix that up and we'll merge for v1.74

### @ncw
> We've had a few of days in the integration tester with huawei drive now and we can see the tests are sometimes flaky...Can you see if you can fix the flaky tests?

### @sanchuanhehe
> When the pacer retried...rest.Call reused the same Reader which had already been consumed to EOF, causing the server to receive an empty body

### @sanchuanhehe
> The API applies NFKC normalization before filename validation, which converts fullwidth ASCII variants straight back to their ASCII originals

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
