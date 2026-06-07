# opencv/opencv #25661 — Highgui backend on top of Framebuffer

**[View PR on GitHub](https://github.com/opencv/opencv/pull/25661)**

| | |
|---|---|
| **Author** | @kozinove |
| **Status** | ✅ merged |
| **Opened** | 2024-05-28 |
| **Repo importance** | ★87,790 · 56,575 forks · score 319,089 |
| **Diff** | +991 / −2 across 10 files |
| **Engagement** | 18 conversation · 86 inline review comments |

## Top review comments (ranked by reactions)

### @kozinove — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2150333236)

> > I just started interactive-calibration tool with web camera. It's built by default. It gets BGR from `cv::VideoCapture`
> 
> We have fixed the offset bug

### @kozinove — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2160557022)

> ![image](https://github.com/opencv/opencv/assets/3440214/a3189ccf-cbe1-40eb-b01f-8c4e937a3b3e)
> 
> I'll try using fbi
> sudo fbi -d /dev/fb0 -T 1 test.jpg
> The test image is white.
> The border is also visible.

### @kozinove — 1 reactions  
`🚀 1`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2186728301)

> fixed work with framebuffer in cmake
> 1. WITH_FRAMBUFFER_XVFB is checked only if there is WITH_FRAMBUFFER=ON
> 2. modules/highgui/cmake/detect_framebuffer.cmake unnecessary comparisons and flag settings have been removed
> 3. modules/highgui/cmake/init.cmake odules/highgui/cmake/init.cmake is called only by add_backend("framebuffer" WITH_FRAMEBUFFER)

### @asmorkalov — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2147351715)

> I tried to build the code without GTK and QT. GUI status is strange:
> ```
> --   GUI:                           NONE
> --     Framebuffer UI:              YES
> ```

### @asmorkalov — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2147360152)

> I was able to run the FB branch with regular Ubuntu 18.04 on desktop:
> - In pure console mode (ctrl+alt+f2) camera preview is rendered on top of terminal in white-green. No normal colors.
> - In X session the app starts by default too, but renders to the same terminal ctrl+alt+f2 with the same white-green colors.

### @kozinove — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/25661#issuecomment-2147479250)

> --   GUI:                           NONE 
> fixed


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
