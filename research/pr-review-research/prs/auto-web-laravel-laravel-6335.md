# laravel/laravel #6335 — Implement L11 welcome page design

**[View PR on GitHub](https://github.com/laravel/laravel/pull/6335)**

| | |
|---|---|
| **Author** | @jasonlbeggs |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @timacdonald
> Can we make sure to have a fallback here in case of CDN failure, i.e., an `onerror` hook that replaces the image tag with something else so that it looks good or re-styles the block in some way? This will ensure that the page looks good offline as well.

### @timacdonald
> I don't think we should have different colors between the welcome page, Breeze, and Jetstream. The skeleton's welcome page becomes part of Breeze and Jetstream. A fresh Breeze install would see one color scheme for the homepage clicking the 'login' link would have you land on a login screen with a different color scheme.

### @timacdonald
> I also note that the size of the background SVG means that, at least on my machine (M1, 2020 Mac mini) in both Firefox and Safari, the browser is _noticeably_ sluggish when resizing the browser window.

### @jasonlbeggs
> I am curious to hear Taylor and the team's thoughts on color variables. I used pretty much all JIT colors here since the styles are inlined and we don't have a Tailwind config.

### @RobiNN1
> Maybe will be good to convert images to data uri so there are no additional files.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
