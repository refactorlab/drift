# tauri-apps/tauri #14523 — Fix(macos/ios): Add handler for web content process termination

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/14523)**

| | |
|---|---|
| **Author** | @JeffTsang |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @velocitysystems
> Nit: `webViewWebContentProcessDidTerminate` is the name of the underlying WebKit API...I see that `on_web_content_process_terminate` is the naming used in WRY, but ideally this should follow the same naming as WebKit.

### @velocitysystems
> The default handler reconstructs the current URL, validates it against the app's base URL, and navigates to it...The `navigate()` approach also has downsides: If the user was on /settings/profile, the /index.html fallback loses their place

### @FabianLars
> How about a very conservative approach? For the initial PR only reload the page. If the app dev wants to they can now add a handler that works for their app as they know best where to navigate to.

### @velocitysystems
> I just have two remaining concerns: 1. `.lock().unwrap()` in the recovery callback. Can this be improved and/or made more resilient? 2. Silent failures with no logging makes debugging difficult

### @JeffTsang
> Adding tests would be good, but it would first require a significant refactor...These decisions should be made by the Tauri team.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
