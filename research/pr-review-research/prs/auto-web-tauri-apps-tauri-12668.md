# tauri-apps/tauri #12668 — feat: introduce `App::run_return`

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/12668)**

| | |
|---|---|
| **Author** | @thomaseizinger |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @FabianLars
> iirc run_return also works on android (though probably good to test that first), only iOS should be a problem.

### @thomaseizinger
> Removing the cfg is a semver-compatible change so we can always do that later? I'd prefer an incremental approach if possible!

### @FabianLars
> It is more correct* and i'd consider it a bug in run_iteration that it didn't do that as well.

### @cuchaz
> After the window closes, and before the process can exit, I need to make sure other resources get cleaned up.

### @thomaseizinger
> Unfortunately, returning a Result is not compatible with running setup inside the event-loop unless we refactor callback.

### @FabianLars
> imo yes

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
