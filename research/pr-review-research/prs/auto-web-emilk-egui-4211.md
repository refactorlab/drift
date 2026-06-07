# emilk/egui #4211 — Fix `ViewportCommand::InnerSize` not resizing viewport on Wayland

**[View PR on GitHub](https://github.com/emilk/egui/pull/4211)**

| | |
|---|---|
| **Author** | @rustbasic |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ColinKinloch
> This doesn't fix #4196. The issue is that on wayland when programmatically resizing a window via `request_inner_size` winit (intentionally) won't receive a `Resized` event.

### @ColinKinloch
> Hense why in #4207 I check the size before and after each `ViewportCommand` is processed and resize the viewport if its changed.

### @ColinKinloch
> It works! Thanks for working on this. I think however that logging 'InnerSize ignered by winit' should be something else. The return values of `request_inner_size` are: None: New size will be in a Resized event; Requested size: The platform has synchronously resized the window; Unchanged size: The platform has denied the request; Different size: The platform has chosen a different size

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
