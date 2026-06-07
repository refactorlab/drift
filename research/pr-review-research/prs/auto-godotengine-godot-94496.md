# godotengine/godot #94496 — [Windows] Support output to HDR monitors

**[View PR on GitHub](https://github.com/godotengine/godot/pull/94496)**

| | |
|---|---|
| **Author** | @DarkKilauea |
| **Status** | ✅ merged |
| **Opened** | 2024-07-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +1582 / −236 across 65 files |
| **Engagement** | 360 conversation · 165 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @DarkKilauea — 19 reactions  
`❤️ 5 · 🎉 9 · 🚀 5`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2601439082)

> Updated the original post with the current status of this PR. I believe it is now ready to be reviewed, with follow up PRs adding support for additional platforms.
> 
> As this missed the 4.4 dev phase, I think we should aim to merge this for 4.5 dev 1 (assuming the required approvals).

### @allenwp — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2645918112)

> I’ve been working on the AgX tonemapper a lot recently and have been developing a better understanding of colour science and modern standards around how HDR image formation should be handled. It seems clear that ACES will need a new tonemapping curve (Output Display Transform) for HDR that is different than the one that is currently used by Godot’s SDR tonemapping shaders.
> 
> I expect this will be the same for AgX, as it follows a lot of the same modern colour and HDR standards as ACES.
> 
> It will be important that Linear, Reinhard, and Filmic use the correct encodings and configurations, according to the modern standards when HDR is enabled and this is something I plan to look more into once I finish with AgX. It’s possible that implementing ACES correctly first will be a good starting point to implementing the rest correctly as well.
> 
> It is also relevant to point out that the ACES implementation in Godot is unconventionally modified by both an “exposure bias” and a “white” parameter. And on top of that, I doubt that too many people have really done a deep dive into ensuring that the ODT tonemapping curve that we use matches standard ACES behaviour because it is obfuscated by optimizations. For these reasons, it will be best to not use it as a reference point at the start of the HDR tonemapping development and only later assess how these differences can be handled. I believe that ACES 1’s ODT for SDR and HDR are quite different and give very different looking images, which is something that people complain about…
> 
> Regardless, it will take me another few weeks at least to get t … *[truncated]*

### @allenwp — 4 reactions  
`👍 4`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2762558827)

> I spent some time prototyping [different approaches to an HDR settings menu](https://github.com/allenwp/hdr-settings-menu) that might exist in a Godot game using this PR.
> 
> https://github.com/user-attachments/assets/e1dabba9-aa5f-4d4b-80cf-a57b8f0855ae
> 
> I found that it was easy to implement most of the menu styles, except that a number of the styles require one modification to this PR: separate `use_screen_max_luminace` and `use_screen_reference_luminance` settings.
> 
> Note: I used the term "**Brightness**" instead of "reference luminance" because this is the correct player-facing term. In my opinion, it does not make sense for a game to present the term "reference luminance" to the player when all it really means is just the overall brightness of the game when using HDR output. I am indifferent on which term is used by Godot scripting/project settings.
> 
> **Style A - Simple**
> Separate brightness and max luminance controls that default to screen values.
> 
> **Style B - Advanced**
> Same as "Style A - Simple", but with nits values always presented to the player, even when they have not been customized.
> 
> **Style C - Ignore Screen Lum.**
> Screen luminance is entirely ignored. For games designed to be played in a home cinema or where the viewing environment's brightness is known in advance.
> 
> **Style D - Screen Luminance Toggle**
> One toggle switch that controls whether screen luminance is used or custom luminance is used for both brightness and max luminance.
> 
> **Style E - Screen Luminance (Saved)**
> Same as "Style D - Screen Luminance Toggle", except the player's previous brightness and max … *[truncated]*

### @DarkKilauea — 3 reactions  
`👍 3`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2503698632)

> @clayjohn Thanks for the input.
> 
> This suggests a new approach that I hadn't considered. If I consider a color value of  1.0, 1.0, 1.0 in the framebuffer as the "paper white" point, instead of the maximum value, I can map values over 1.0 into the extended range for the display. This would allow devs to control how bright the UI appears by setting that "paper white" point in terms of nits. Then, both 2D and 3D elements can be brighter than that in terms of multiples of the "paper white" point. For example, a value of 2.0 would be roughly twice as bright as the "paper white" point (I'm hand waving away the logarithmic scaling applied by PQ ST.2084 in this example).
> 
> I think this also gives more artistic control, since you have the ability to make an element in the scene exactly 400 nits on the display. The trick is trying to avoid clipping for displays that aren't that capable. I'm not sure if I should allow it to clip for brightness values over the capability of the display, or attempt to scale them into the supported range as the current method does.
> 
> Either way, I think I will give it a try and see how it works out. It would massively simplify the effort.

### @DarkKilauea — 2 reactions  
`👍 2`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2527142438)

> Update:
> 
> I'm done some playing around with mapping 1.0 in the frame buffer to the max brightness of SDR elements and it seems to work well. It solves several problems around modifying the canvas shader and tonemap effect to map each individually to a different brightness. It does require that `hdr_2d` is enabled on the main viewport in order to allow color values to exceed 1 and use the additional brightness available in HDR displays.
> 
> I went ahead and changed the names of several methods to indicate that they now control the SDR reference brightness.
> 
> There are some drawbacks however that may need to be worked around (I could use some help here):
> 
> 1. There isn't currently a way to automatically limit the brightness of the scene to prevent blowing out the display. Currently, the user has the change the tonemap exposure settings to keep the brightness in check. I'm not sure how to pass the min and max allowed brightness into the auto-exposure feature in order to achieve this, since the values are set in ISO and I'm not sure how to map those to absolute values in the color buffer. Ideally, I'd be able to tell the auto-exposure feature to keep values in the buffer between, say 0.1 and 4.0.
> 2. The Flimic and ACES tonemappers seem to limit the brightness of the final output to 1.0, preventing HDR output from working correctly. Reinhard and Linear do work and are what I'd recommend using for now for testing. I'm not sure why Flimic and ACES have this limitation, but I've confirmed it using RenderDoc.
> 3. I'm not sure if setting the reference, min, and max luminance on the viewport … *[truncated]*

### @DarkKilauea — 2 reactions  
`👍 2`  ·  [link](https://github.com/godotengine/godot/pull/94496#issuecomment-2543338843)

> > While testing tonemapping in different scenes, I've noticed another oddity. It seems like some tonemappers (ACES in particular) sometimes output negative RGB values. I think in current Godot this is simply ignored, but with this branch it causes problems because the ST2084 function isn't designed to handle negative values because "negative nits" doesn't make any sense. The result is dark objects in certain scenes look weird.
> > 
> > One possible fix that would require minimal changes would be to normalize the values in the ST2084 function, like this: [7cb6ad8](https://github.com/godotengine/godot/commit/7cb6ad8624e5cb659215d03804eada5fe6797764)
> > 
> > Alternately, we could fix the tonemappers, although I'm not 100% sure if the negative values are a bug or not... I don't really understand how the tonemappers work under the hood.
> 
> That makes sense, I'll add a limit to prevent the values from going negative.  Technically, this is allowed in the `scRGB` color space (which I'm working to add support for), but definitely doesn't work with the ST2084/PQ transfer function.
> 
> The conversion to sRGB always clamps to the range [0..1], so I think this wasn't noticed before.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
