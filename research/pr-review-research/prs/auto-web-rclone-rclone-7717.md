# rclone/rclone #7717 — backend: Add Apple iCloud Drive backend

**[View PR on GitHub](https://github.com/rclone/rclone/pull/7717)**

| | |
|---|---|
| **Author** | @lostb1t |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ncw
> where did the `client_id` come from? are you running through the integration tests?

### @ncw
> Do you have to use the etags? They are optional for most cloud storage systems and rclone doesn't use them. This means that the last write wins which is what we want.

### @ncw
> Running the integration tests will guide you through what you need to do. You can start running them as soon as you've done `List`.

### @cescofry
> I also struggled when looking for iCloud in the list of rclone remotes as it has not be inserted in the right alphabetical spot.

### @ncw
> Shall I... Mark it as experimental in the docs... Leave it out the 1.69 release?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
