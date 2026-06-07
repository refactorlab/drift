# flutter/flutter #167806 — Add RawMenuAnchor animation callbacks

**[View PR on GitHub](https://github.com/flutter/flutter/pull/167806)**

| | |
|---|---|
| **Author** | @davidhicks980 |
| **Status** | ✅ merged |
| **Opened** | 2025-04-25 |
| **Repo importance** | ★176,771 · 30,472 forks · score 303,659 |
| **Diff** | +1761 / −115 across 6 files |
| **Engagement** | 22 conversation · 234 inline review comments |

## Top review comments (ranked by reactions)

### @Albert221 — 7 reactions  
`👍 7`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-3195572618)

> @davidhicks980 making the `MenuController` _final_ just broke our code, we were extending the `MenuController` to add some animation functionality. Was this breaking change really intended?

### @davidhicks980 — 1 reactions  
`👍 1`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-2961319066)

> Note: I just added a change to reduce the number of scrolling/resizing subscriptions. No tests broke, and it should be effectively the same code.
> 
> <img width="713" alt="image" src="https://github.com/user-attachments/assets/b56c4ad1-11fd-403c-baa4-fdf57935ea05" />

### @davidhicks980 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-3199180509)

> @dkwingsmt `MenuController.maybeOf(context)` is a convenience getter, albeit it's very useful for nested menus. The issue `final` addresses is, if you passed an `AnimatedMenuController()` subclass of MenuController to a `RawMenuAnchor()` or a `RawMenuAnchor` derivative (e.g. `MenuAnchor`), `MenuController.maybeOf(context)` would return a value statically typed as `MenuController` rather than `AnimatedMenuController`. However, during runtime the `AnimatedMenuController` instance is indeed passed via the inherited widget, so users just need to perform a type check if they wanted strict typing. 
> 
> Anyways, imo removing the `final` class modifier is a minimal change that we should probably make. Let me know how to proceed. I'm not sure if a revert-then-recommit or a PR just removing "final" is more appropriate.
> 
> https://github.com/user-attachments/assets/ebea112d-fd74-418b-bf90-72ef71378a59

### @davidhicks980 — 0 reactions  
`—`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-2850013169)

> @dkwingsmt 
> > No, I mean keeping the handleOpenRequested as pure method and move the implementation to the two state classes. Is it possible?
> 
> I missed this comment. I think I pushed changes that do this -- let me know if it looks right. By pure method, are you referring to an abstract method in _RawMenuAnchorBaseMixin?

### @davidhicks980 — 0 reactions  
`—`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-2921968928)

> @dkwingsmt I can't respond to your question about futures for some reason. You're using a future here, which is not cancelable. If you use a timer, 
> 
> ```dart
>  onCloseRequested: (hideOverlay) {
>     _timer.cancel()
>     _timer = null;
>   },
>  onOpenRequested: (Offset? position, showOverlay) {
>     _timer ??= Timer(Duration(milliseconds: 100), () {
>       showOverlay();
>       animationController.forward()
>     });
>   }
> ```
> 
> Also, developers wouldn't have the option to not call showOverlay or hideOverlay if we used futures.
> 
> Oh, also sorry for not updating the docs. I posted up the code then took a break. Everything should be up-to-date.

### @dkwingsmt — 0 reactions  
`—`  ·  [link](https://github.com/flutter/flutter/pull/167806#issuecomment-2923014786)

> @davidhicks980 A timer doesn't cover all use cases of delaying. The app might want to delay the `showOverlay` call until some event happens, which is not appropriate with a timer.
> 
> The developer can throw an error to not call the callback. Or probably better, we can make it a `Future<bool>`. Although it uses an additional boolean information, I think this is the cost we have to pay in order to disallow calling the callback multiple times.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
