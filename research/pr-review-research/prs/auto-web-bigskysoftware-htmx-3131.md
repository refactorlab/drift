# bigskysoftware/htmx #3131 — Attach hx-on handlers before processing nodes

**[View PR on GitHub](https://github.com/bigskysoftware/htmx/pull/3131)**

| | |
|---|---|
| **Author** | @rkilpadi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @1cg
> Is there any inadvertent semantic changes with this?

### @1cg
> this is a little scary to me wrt unintended timing consequences for existing users.

### @MichaelWest22
> I was unable to find any problematic semantic changes when I explored this change. It is just changing the order of some init code.

### @MichaelWest22
> the only change is that nodes get hashed first then hx-on listeners get added and then the final init happens posting before and after events...seems fine to me.

### @rkilpadi
> I was a little hesitant just because at first glance it looks like the change cleans up an element that wasn't affected before

### @MichaelWest22
> I can't find any change that would alter expected behavior for users apps other than those using hx-on to listen to before/after process node events.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
