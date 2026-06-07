# rclone/rclone #8292 — Add FileLu cloud storage backend

**[View PR on GitHub](https://github.com/rclone/rclone/pull/8292)**

| | |
|---|---|
| **Author** | @kingston125 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ncw
> This is missing calls to the pacer. If you look at an example backend you'll see api calls are wrapped in a pacer.

### @ncw
> This is not using rclone's HTTP stack. Can you make it use `lib/rest` please? Without that features like `--bwlimit`, `--dump headers`, `--tpslimit` won't work.

### @ncw
> The backend can clearly do DirMove, Copy according to the backend commands but these aren't implemented as optional features.

### @ncw
> You should be able to fix all the `FsEncoding` tests using `Enc` you have defined...You need to use it like this

### @ncw
> I suspect one of the tests is leaving a file behind which is upsetting the other ones - that is usually the problem. So maybe the delete with the special character isn't working?

### @ncw
> If your backend can't natively do recursive listings then don't implement this. Rclone has a much more sophisticated walkDir built in.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
