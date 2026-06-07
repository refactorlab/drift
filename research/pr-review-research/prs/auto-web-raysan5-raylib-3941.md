# raysan5/raylib #3941 — make RGFW a custom platform

**[View PR on GitHub](https://github.com/raysan5/raylib/pull/3941)**

| | |
|---|---|
| **Author** | @ColleagueRiley |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @raysan5
> Added some notes, it seems some changes from raylib master branch get into the changelist. I also note `glad` removal implies a considerable review of `rlgl`, I think it should be on a separate PR for proper review.

### @raysan5
> I'm trying to compile `core_basic_window` example with VS202 on `PLATFORM_DESKTOP_RGFW` and I get this issue [with error screenshot showing undefined reference].

### @raysan5
> @ColleagueRiley I reviewed it again and it keeps failing. When I change to `PLATFORM_DESKTOP` (GLFW) it works ok but `PLATFORM_DESKTOP_RGFW` complaints about that missing symbol. WinMM is passed to the linker.

### @ColleagueRiley
> I replied to two of your comments and I agree that the RLGL part should be in its own PR.

### @raysan5
> Good catch! That functionality should be probably moved from `rcore.c` to every specific platform... `rcore.c` tries to be as much platform-independant as possible...

### @ColleagueRiley
> That would be silly. This is a one line thing and plus you already use 4 other winapi functions for file I/O.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
