# godotengine/godot #102552 — Add shader baker to project exporter.

**[View PR on GitHub](https://github.com/godotengine/godot/pull/102552)**

| | |
|---|---|
| **Author** | @DarioSamo |
| **Status** | ✅ merged |
| **Opened** | 2025-02-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +5781 / −4198 across 112 files |
| **Engagement** | 153 conversation · 128 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @kisg — 10 reactions  
`🎉 10`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2725311986)

> FYI:
> 
> We have a working Metal implementation of the Shader Baker. It supports both runtime (where we bake the MSL source code) and offline Metal compilation. The offline compilation generates the platform independent bytecode (AIR) format. 
> 
> In our test application the MSL baking did not make much difference, but with the AIR baking the first startup time went from ~ 7+ seconds to ~2 - 2.5 seconds. The same app with Vulkan (with Shader Baker enabled, so SPIR-V baked in the app) + MoltenVK starts in ~5.1 seconds.
> 
> We have to clean it up a bit (currently it only supports iOS targets, no MacOS), but we hope to publish it soon as a PR for this PR.

### @TCROC — 8 reactions  
`❤️ 8`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2905515085)

> Great work @DarioSamo @kisg @stuartcarnie @RandomShaper and everyone else involved in this PR that I may be leaving out.  This improves load times tremendously!  Very well done!

### @DarioSamo — 4 reactions  
`👍 4`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2648153706)

> > One concern I have is for users exporting to Windows from Linux (which is a common scenario on CI). While it should be possible to export SPIR-V already for projects using Vulkan, exporting DXIL for Direct3D doesn't sound feasible right now. None of the D3D12 code is compiled in the Linux editor which is used for exporting on CI. This also applies to users exporting for macOS from other platforms.
> 
> The only D3D12 code that is required at the moment is root signature serialization to a binary blob. If that can be worked around (CC @RandomShaper), then D3D12 is not a requirement for building D3D12 shaders.
> 
> > More generally, I don't know if this shader compilation process will work in headless anyway (since no GPU is initialized, and none is available on GitHub Actions unless you pay for it).
> 
> The shader classes aren't tied to a particular driver running. No GPU is required for the process, as that was part of most of the refactoring that was done to take it out of the drivers and into their own classes that can be used independently.

### @kisg — 3 reactions  
`❤️ 1 · 🎉 1 · 🚀 1`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2784862932)

> > @kisg Now that it is rebased, what is your timeline for making a PR?
> 
> Just opened the PR in @DarioSamo's repository: https://github.com/DarioSamo/godot/pull/2
> 
> Or can I open it here against this PR?

### @TCROC — 3 reactions  
`🚀 3`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2905504312)

> AYO!!  All is working as expected!!  The two remaining issues can me marked resolved!
> 
> 1. https://github.com/godotengine/godot/pull/102552#issuecomment-2902303364 ✅
> 2. https://github.com/godotengine/godot/pull/102552#discussion_r2098995038 ✅
> 
> Lets get this PR pushed through! :)

### @stuartcarnie — 2 reactions  
`👍 2`  ·  [link](https://github.com/godotengine/godot/pull/102552#issuecomment-2691370242)

> 👋🏻 @kisg 
> 
> # Overview: Metal
> 
> Currently, we use SPIRV-Cross to generate Metal Shader Language (MSL) from the SPIR-V and serialise this source to the binary data. We want to be able to support using the offline Metal compiler toolchain so that we can generate a `.metallib` file, when the toolchain is available. It isn't required, but will further reduce startup time, as devices such as iOS won't have to execute the Metal Compiler background task to compile the MSL first.
> 
> # Solution Sketch: Metal
> 
> To support MSL and .metallib, we should extend `ShaderBinaryData`:
> 
> https://github.com/godotengine/godot/blob/5312811c4da268892087a88d2b5cdc716f2c219e/drivers/metal/rendering_device_driver_metal.mm#L1557
> 
> and a `library_type` field, that is an enumeration:
> 
> ```cpp
> enum LibraryType {
>   METAL_SHADER_LANGUAGE,
>   METAL_LIBRARY,
> }
> ```
> 
> > [!NOTE]
> >
> > Adding a field will require the version is updated:
> >
> > https://github.com/godotengine/godot/blob/5312811c4da268892087a88d2b5cdc716f2c219e/drivers/metal/rendering_device_driver_metal.mm#L1076
> 
> The remainder of the work is just implementing the container, as @DarioSamo has done for Vulkan and D3D12. _Don't worry about implementing offline compilation for your initial PR_
> 
> # Offline compilation
> 
> Offline compilation takes the MSL and create a `.metallib`. See [this page](https://developer.apple.com/documentation/metal/building-a-shader-library-by-precompiling-source-files?language=objc) for more information.
> 
> Future work will add support to spawn the Metal compiler toolchain, which is available for macOS and Window platforms, and generate `.m … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
