# rustdesk/rustdesk #13247 — Edge scrolling

**[View PR on GitHub](https://github.com/rustdesk/rustdesk/pull/13247)**

| | |
|---|---|
| **Author** | @logiclrd |
| **Status** | ✅ merged |
| **Opened** | 2025-10-21 |
| **Repo importance** | ★115,597 · 17,458 forks · score 190,413 |
| **Diff** | +669 / −52 across 67 files |
| **Engagement** | 69 conversation · 93 inline review comments |

## Top review comments (ranked by reactions)

### @fufesou — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3430698814)

> This patch fixes the build error on macOS, but it introduces unexpected behavior: the mouse cursor jumps to the edge of the screen when it moves to the edge of the remote window.
> 
> I need to test more on Linux.
> 
> ```
> --- a/flutter/macos/Runner/MainFlutterWindow.swift
> +++ b/flutter/macos/Runner/MainFlutterWindow.swift
> @@ -112,12 +112,14 @@ class MainFlutterWindow: NSWindow {
>                      let dx = (arg["dx"] as? Int) ?? 0;
>                      let dy = (arg["dy"] as? Int) ?? 0;
>  
> -                    if let mouseLoc = self.rustDeskViewController?.mouseLocation {
> -                        mouseLoc.y = NSHeight(NSScreen.screens()![0].frame) - mouseLoc.y;
> +                    if var mouseLoc = self.rustDeskViewController?.mouseLocation {
> +                        if let screenFrame = NSScreen.screens.first?.frame {
> +                            mouseLoc.y = NSHeight(screenFrame) - mouseLoc.y
>  
> -                        let newLoc = CGPoint(x: mouseLoc.x + dx, y: mouseLoc.y + dy);
> +                            let newLoc = CGPoint(x: mouseLoc.x + CGFloat(dx), y: mouseLoc.
> y + CGFloat(dy))
>  
> -                        CGDisplayMoveCursorToPoint(0, newLoc);
> +                            CGDisplayMoveCursorToPoint(CGMainDisplayID(), newLoc)
> +                        }
>                      }
>  
>                      result(nil)
> ```

### @logiclrd — 1 reactions  
`👍 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3434708759)

> Great news 🙂 I figured out by local environment problems (turns out it's just that Flutter itself doesn't support Visual Studio 2026 yet, but I managed to work around that), and the Windows code builds and works properly 🙂

### @logiclrd — 1 reactions  
`👍 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3437472021)

> @fufesou Alright, assuming I haven't made any silly mistakes, this next build should address points 1 and 2 and add debug output to help figure out what's going on with point 3.
> 
> It occurs to me that when the resize speed is low, the mitigation for point 2 will actually incidentally fix the resizing behaviour as well. So unless you're resizing the window quickly, you might actually see normal resize behaviour. But what's of interest is whether it's receiving continuous `onWindowResize` events during the resize action or not.
> 
> Thanks so much for trying out these changes on OS X and helping me get them polished up :smile:

### @logiclrd — 1 reactions  
`👍 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3458396949)

> To explain a little: I had made changes to support X11 and Wayland, and as part of those changes I reworked the Linux platform back-end, refactoring bump_mouse out into multiple files to allow the code to be kept separated. After determining that the Wayland implementation is a no-go today, I split the Git commit apart, keeping the end result but separating the Wayland-specific stuff into an isolated commit. I also split up other unrelated changes into their own commits.
> 
> Everything but the Wayland commit is now on this branch, and the https://github.com/logiclrd/rustdesk/pull/1 PR in my fork shows the Wayland changes on top of these changes.

### @fufesou — 1 reactions  
`👍 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3461697241)

> > In both cases, this output only appears for debug builds. Should I still suppress it?
> 
> Yes.
> 
> There are too many prints here.
> The ones for this call are no longer needed now that the logic has been debugged.

### @fufesou — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rustdesk/rustdesk/pull/13247#issuecomment-3465982972)

> This function is working excellently across all platforms - Windows, X11, Wayland, and macOS. Let's go through a few rounds of Copilot review to make sure everything is solid.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
