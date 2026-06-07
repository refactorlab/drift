# rclone/rclone #9234 — iclouddrive: add iCloud Photos support and SRP authentication

**[View PR on GitHub](https://github.com/rclone/rclone/pull/9234)**

| | |
|---|---|
| **Author** | @Lyapsus |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ncw
> I've spent some time reviewing this and it looks very good indeed. I shall merge this for v1.74 which should make the icloud users very happy to have working 2FA and photos access.

### @stv0g
> Many operations are fairly slow...Looking at the debug trace, it appears to me that the initial validation of the session takes about 5 seconds, before any subsequent request is performed?

_Note: This PR's conversation consisted largely of user testing feedback, clarifications, and incremental bug fixes rather than competing design debates; the comments above are the most substantive human review prose retrievable from the conversation page._

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
