# electron/electron #42953 — feat: GPU shared texture offscreen rendering

**[View PR on GitHub](https://github.com/electron/electron/pull/42953)**

| | |
|---|---|
| **Author** | @reitowo |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @samuelmaddock
> Electron's desktopCapturer uses this format. Would it be affected?

### @itsananderson
> If someone enables this feature, but neglects to call `texture.release()`, it sounds like that could cause a memory leak... Would it be possible to monitor for when the JS `texture` object is getting GC'd and either release the shared texture automatically or print a warning?

### @reitowo
> Relying on GC is not working because the unknown timing. 10 frames are only 160ms at 60fps and GC are not running that fast.

### @samuelmaddock
> looks like the patch needs to be updated as it's failing to apply.

### @reitowo
> I managed to add `ARGB + kGpuMemoryBuffer` support for FrameSinkVideoCapturer in recent upstream changes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
