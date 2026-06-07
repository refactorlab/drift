# tauri-apps/tauri #14959 — refactor: replace `kuchikiki` with `dom_query`

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/14959)**

| | |
|---|---|
| **Author** | @thomaseizinger |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Legend-Master
> Could we preserve the non mut version of those functions? Asking because it is technically going to break people updating `tauri-utils` without bumping `tauri`

### @Legend-Master
> problem is that we re-export tauri-utils in tauri as tauri::utils

### @FabianLars
> if we could mimic the api in a way that would not break 'old' tauri-codegen and tauri versions that somehow use newer tauri-utils versions

### @Legend-Master
> Juggling feature flags is not exactly easy, it feels to me that this is too much effort for upgrading a non-critical dependency here

### @thomaseizinger
> I think it is actually a great idea IF the boundaries of the crates are designed around their functionality, i.e. `tauri-html` etc.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
