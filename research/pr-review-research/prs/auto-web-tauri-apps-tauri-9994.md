# tauri-apps/tauri #9994 — feat!(nsis): add an option to customize start menu folder

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/9994)**

| | |
|---|---|
| **Author** | @Legend-Master |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: the web fetch of this conversation returned summarized review prose rather than fully verbatim text for some comments. The reviewer names and the substance of each point are preserved below; quoted fragments are verbatim where retrievable.

### @amrbashir
> Unpin start menu shortcut on uninstall

(Flagged that shortcuts should be unpinned from the taskbar when the application is uninstalled to prevent orphaned references.)

### @Legend-Master
> If old installer was using `StartMenu/App/App.lnk` and new installer uses: With same folder name: Everything stays the same

(Detailed the migration behavior across installer versions with different start menu configurations.)

### @Legend-Master
> Check if shortcut actually targets our binary

(Added verification to prevent accidental deletion of unrelated shortcuts during migration.)

### @amrbashir
(Requested changes on the configuration and NSIS template implementation details — how the start menu folder customization should be structured and documented.)

### @amrbashir
(Required clarification on breaking-change documentation and proper handling of backward compatibility between installer versions with different start menu configurations.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
