# Genymobile/scrcpy #5455 — On-device OpenGL video filters

**[View PR on GitHub](https://github.com/Genymobile/scrcpy/pull/5455)**

| | |
|---|---|
| **Author** | @rom1v |
| **Status** | ✅ merged |
| **Opened** | 2024-11-07 |
| **Repo importance** | ★143,036 · 13,192 forks · score 200,707 |
| **Diff** | +1924 / −587 across 37 files |
| **Engagement** | 37 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @dudwns9426 — 4 reactions  
`👍 4`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2550686062)

> Thank you, I am using scrcpy 3.0 with metaquest3,
> I got the left eye of metaquest3 with this command,
> scrcpy --crop=1280:1104:588:552 --angle=22 --video-bit-rate=2M --max-fps=15

### @4nric — 3 reactions  
`👍 1 · ❤️ 1 · 🎉 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2483088348)

> I can confirm rotation now works on all cases 😊 tested to work on Android 14 both main display and virtual display. Android 9 also. Just noticed that [glfilter.65](https://github.com/Genymobile/scrcpy/commit/108abf486a292dd84734edcb1ac3e15f3b161542) commit is missing the AIDL file. Noticed when I tried to compile https://github.com/Genymobile/scrcpy/pull/5498/commits/9e95811bd3c284ecd4e3e4aeb433bedb58eefe90

### @rom1v — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2466840385)

> I've made some progress this week-end:
>  - I reimplemented `--crop` for screen capture, which now works on all devices, including Android >= 14
>  - I reimplemented `--lock-video-orientation` for screen capture, which now works on all devices, including Android >= 14
>  - I implemented virtual display rotation
>  - All the events are correctly mapped according to the affine transformations
> 
> Please review/test! In particular, make sure that everything works with any crop, locked video orientation, physical device rotation, resize… on devices with and without Android 14. Check that:
>  - the video content must matches the configuration
>  - all your clicks are correctly mapped
> 
> In a virtual display (`scrcpy --new-display`), an app which automatically rotates (or manually, with <kbd>Alt</kbd>+<kbd>r</kbd>) rotates the display.
> 
> ## TODO
> 
> I wanted to add support for `--crop` for camera capture and virtual display capture (because why not!?), but it fact there is a semantic issue: for these sources, `-m`/`--max-size` selects the source size, it does not resize a predefined source like for screen capture. So when we `--crop` and `-m`, it will not behave the same way (it will select another source, then crop). ~So I think I will not implement `--crop` for camera and virtual display (it's probably useless in practice anyway).~
> Or maybe we can just accept to crop the size selected by `-m`, it's smaller than the source anyway.
> 
> I will:
>  - implement `--lock-video-orientation` (and `--crop`?) for camera and virtual displays
>  - add `--angle` to specify a custom angle (e.g. 22°, for Meta Quest 3 mir … *[truncated]*

### @rom1v — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2481152551)

> Thank you very much for your tests and bug report, that's very helpful! :heart: 
> 
> I fixed my "display size monitor" when it used fallbacks. The problem only happened on Android 14 >= r1 to Android 14 < r29 (and I have no such device, so I simulated the problem and reproduced).
> 
> Fixed in `glfilter.63`.

### @Helaer — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2481164251)

> > Thank you very much for your tests and bug report, that's very helpful! ❤️
> > 
> > I fixed my "display size monitor" when it used fallbacks. The problem only happened on Android 14 >= r1 to Android 14 < r29 (and I have no such device, so I simulated the problem and reproduced).
> > 
> > Fixed in `glfilter.63`.
> 
> Very good, glfilter. 63 worked very well on my Android 10 and Android 14 devices.

### @4nric — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/5455#issuecomment-2483112554)

> Camera rotation fails 😅
> 
> `scrcpy --video-source=camera --capture-orientation=90 `
> 
> ```
> C:\Users\anric\Downloads\scrcpy-win64-glfilter.65\scrcpy-server: 1 file pushed, 0 skipped. 101.9 MB/s (164641 bytes in 0.002s)
> [server] INFO: Device: [samsung] samsung SM-S908B (Android 14)
> [server] INFO: Using camera '0'
> INFO: Renderer: direct3d
> INFO: Texture: 3024x4032
> [server] INFO: Retrying with -m2560...
> [server] INFO: Retrying...
> [server] ERROR: Encoding error: java.lang.IllegalStateException:
> [server] ERROR: Exception on thread Thread[OpenGLRunner,5,main]
> java.lang.RuntimeException: glError 0x505 out of memory
>         at com.genymobile.scrcpy.opengl.GLUtils.checkGlError(GLUtils.java:99)
>         at com.genymobile.scrcpy.opengl.AffineOpenGLFilter.draw(AffineOpenGLFilter.java:128)
>         at com.genymobile.scrcpy.opengl.OpenGLRunner.render(OpenGLRunner.java:218)
>         at com.genymobile.scrcpy.opengl.OpenGLRunner.lambda$run$1$com-genymobile-scrcpy-opengl-OpenGLRunner(OpenGLRunner.java:200)
>         at com.genymobile.scrcpy.opengl.OpenGLRunner$$ExternalSyntheticLambda0.onFrameAvailable(D8$$SyntheticClass:0)
>         at android.graphics.SurfaceTexture$1.handleMessage(Unknown Source:4)
>         at android.os.Handler.dispatchMessage(Unknown Source:19)
>         at android.os.Looper.loopOnce(Unknown Source:185)
>         at android.os.Looper.loop(Unknown Source:83)
>         at android.os.HandlerThread.run(Unknown Source:28)
> [server] ERROR: Exception on thread Thread[video,5,main]
> java.lang.AssertionError
>         at com.genymobile.scrcpy.video.CameraCapture.start(CameraCapture.java:256)
>         a … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
