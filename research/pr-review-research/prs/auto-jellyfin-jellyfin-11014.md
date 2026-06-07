# jellyfin/jellyfin #11014 — feat: Fully support hardware filters on Apple VideoToolbox

**[View PR on GitHub](https://github.com/jellyfin/jellyfin/pull/11014)**

| | |
|---|---|
| **Author** | @gnattu |
| **Status** | ✅ merged |
| **Opened** | 2024-02-15 |
| **Repo importance** | ★52,933 · 4,927 forks · score 77,636 |
| **Diff** | +169 / −33 across 3 files |
| **Engagement** | 59 conversation · 22 inline review comments |

## Top review comments (ranked by reactions)

### @gnattu — 1 reactions  
`👍 1`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1951530707)

> The initial working tree is pushed here:
> https://github.com/gnattu/jellyfin-ffmpeg/commit/587a97ae02c8052c65d5c266d6048539b9c0eebd
> 
> Before submitting this upstream, I'd like to receive some suggestions first.

### @nyanmisaka — 1 reactions  
`👍 1`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1960041905)

> There are massive changes to `hwcontext_vulkan` of FF 6.1 that break our existing AMD VAAPI->Vulkan pipeline and it will take me some time to fix and test it. In addition, upstream reports more breakage related to Vulkan in FF 6.1.
> 
> I think we shouldn't do this rashly before the release of a new Jellyfin version. Similarly, FF 7.0 may arrive someday in the next few months, and it will introduce multi-threading globally and will require more testing. Therefore it is best to backport `scale_vt` to 6.0.

### @gnattu — 1 reactions  
`👀 1`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1968630289)

> Updated to support all hardware filters of VideoToolbox. Now all main features: de-interlace,  scale, HDR->SDR tone mapping(including DOVI Profile 5), HDR pass-though and subtitles burn in should be supported by hardware.

### @gnattu — 0 reactions  
`—`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1951042660)

> It now works with incorrect colorspace (as the main is in YUV and the overlay is in BGRA):
> 
> <img width="1402" alt="image" src="https://github.com/jellyfin/jellyfin/assets/12995396/a41522fa-7c90-4e56-9d4e-c9f8754f44b2">
> 
> To handle the colorspace, we have multiple approaches here, and this could be very specific to `videotoolbox`, as the other approaches like the CUDA implementation assume the two layers have matching pixel formats, so they do not perform any conversion.
> 
> The most native way would be to use [CoreImage](https://developer.apple.com/documentation/coreimage?language=objc), generate an intermediate image with [`-[CIImage initWithCVPixelBuffer:]`](https://developer.apple.com/documentation/coreimage/ciimage/1438072-initwithcvpixelbuffer), then set [`kCIContextWorkingColorSpace`](https://developer.apple.com/documentation/coreimage/kcicontextworkingcolorspace) to the `CIContext`, and finally render it into another `CVPixelBuffer` with [`-[CIContext render:toCVPixelBuffer:bounds:colorSpace:]`](https://developer.apple.com/documentation/coreimage/cicontext/1437835-render). This approach could give us the most correct result, as it properly handles gamma correction, but having an intermediate image for every frame could be slower. (Note: CoreImage does have a Metal backend, but ffmpeg's own CoreImage filter only uses the old OpenGL backend. If I'm going with this approach, I will create my own `CIContext` with Metal.)
> 
> Another approach we could try is to bypass the `HWContenxt` of VideoToolBox and use a custom matrix in Metal to generate a `texture2d` with YCbCr, with an … *[truncated]*

### @gnattu — 0 reactions  
`—`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1951170189)

> The CoreImage approach had initial success with color:
> <img width="1402" alt="image" src="https://github.com/jellyfin/jellyfin/assets/12995396/d39f2cac-4b5b-4ba8-a1af-52ecc096a76b">
> 
> A big problem is that the frames appears not to be "in order", and it the video seems to be "vibrating" back and forth. What could be the cause of this? My assumption is that the frame_sync has something happened, but I'm not quite sure on how to fix that.

### @gnattu — 0 reactions  
`—`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11014#issuecomment-1951177337)

> Attaching the example file for reference.
> [test.mp4.zip](https://github.com/jellyfin/jellyfin/files/14322231/test.mp4.zip)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
