# BabylonJS/Babylon.js #16773 — OpenPBRMaterial (including loading and exporting glTF)

**[View PR on GitHub](https://github.com/BabylonJS/Babylon.js/pull/16773)**

| | |
|---|---|
| **Author** | @MiiBond |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Popov72
> Just so I understand correctly, for now, you have simply copied and pasted the existing PBR vertex/fragment shaders to create the OpenPBR shaders? I don't know if you have discussed the rewrite with @sebavan, but in my opinion, we should start from scratch without any defines and implement what is necessary for OpenPBR in the cleanest way possible.

### @MiiBond
> This is actually what I started doing but I quickly realized that there is a ton of stuff that we still want to support like SH (in VS and FS), pre-filtered IBL, realtime IBL, analytic lights, etc. Also morph targets, skinning, etc. I'm still planning on removing ALL of the current material properties copied from PBRMaterial while retaining the logic for lighting, animation, etc.

### @MiiBond
> I've been playing with mixins to try to remove a lot of duplicate code from the materials. I figured, if we can do this, it'll make my life easier when working on PBR2. I started with using mixins for some defines like UV1, UV2, etc. and the image-processing defines.

### @sebavan
> looks all good to me, @bghgary all good on the gltf side ?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
