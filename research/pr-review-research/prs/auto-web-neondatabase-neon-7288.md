# neondatabase/neon #7288 — Restore running xacts from CLOG on replica startup

**[View PR on GitHub](https://github.com/neondatabase/neon/pull/7288)**

| | |
|---|---|
| **Author** | @knizhnik |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hlinnaka
> Can we do this in the neon extension instead of patching StartupXLog? I think so. You can do this after startup, and call ProcArrayApplyRecoveryInfo() with the list of xids.

### @hlinnaka
> What to do if the list of XIDs is too large? As this stands, you'll get an 'too many KnownAssignedXids' error, which isn't great.

### @hlinnaka
> If the list of XIDs scanned from CLOG don't fit in known-assigned XIDs, with enough free space so that we won't run out of space later during replay either, then start with that. Otherwise, bail out and wait for the next running-xacts record, like Postgres normally does.

### @knizhnik
> Replica will wait for non-overflowed running xacts. And it can arrive only after commit. So starting replica and doing commit after it is not possible.

### @knizhnik
> Please notice 15 seconds pause before neon_rm_startup is invoked. The reason is that RMGR-s are initialised lazily after receiving first WAL record.

### @arssher
> Thanks for the detailed descriptions, with their immense help I've got an impression that I now understand all touched places.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
