# godotengine/godot #107391 — OpenXR: Add support for spatial entities extension

**[View PR on GitHub](https://github.com/godotengine/godot/pull/107391)**

| | |
|---|---|
| **Author** | @BastiaanOlij |
| **Status** | ✅ merged |
| **Opened** | 2025-06-11 |
| **Repo** | curated review-culture seed |
| **Diff** | +7550 / −17 across 54 files |
| **Engagement** | 16 conversation · 293 inline review comments |

## Top review comments (ranked by reactions)

### @BastiaanOlij — 2 reactions  
`👍 2`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-2961535231)

> Note: Seeing we're pretty much in feature freeze for Godot 4.5, this PR is currently set for inclusion in Godot 4.6.
> 
> However if consensus is met in time, I'm hoping we can merge this as an experimental feature in Godot 4.5 as the functionality should not impact any users that do not enable it.
> 
> This is worth further discussion.

### @Repiteo — 2 reactions  
`🎉 2`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-3343727057)

> Thanks! Great work covering all those bases!

### @BastiaanOlij — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-3341031891)

> @AThousandShips I did most of your clean up suggestions, there are one or two outstanding questions and I didn't do all the changes away from `nullptr`, too easy to mess up.
> 
> I suggest that whatever is left we do as a separate PR, that was a LOT to get through :)

### @BastiaanOlij — 0 reactions  
`—`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-2990469236)

> @dsnopek @m4gr3d 
> 
> Ok, I've worked through most of the feedback. Few questions and remarks I've left open up above, so feel free to mark those as resolved if you're happy with the feedback.
> 
> The biggest structural change is that I've added some XR versions of our binding macros that allow us to bind OpenXR enums and expose them in Godot. I'm pretty happy with this approach and we should slowly clean up existing enums to do the same.
> The only discussion left here is whether we're happy to have the enums live on the objects they most directly related to, or if we should introduce a container class or something. It is possible that the issues here I originally ran into are already solved with improvements I made to the macros later. I'll do some more testing with that tomorrow.
> 
> The only outstanding task is to complete the logic for the meshes/collision shapes on Mesh2D and Polygon2D entities coming from plane tracking. Should be able to do that over the weekend.

### @BastiaanOlij — 0 reactions  
`—`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-2990502953)

> Marked all classes introduced as experimental.

### @dsnopek — 0 reactions  
`—`  ·  [link](https://github.com/godotengine/godot/pull/107391#issuecomment-2991519926)

> > The biggest structural change is that I've added some XR versions of our binding macros that allow us to bind OpenXR enums and expose them in Godot. I'm pretty happy with this approach and we should slowly clean up existing enums to do the same.
> 
> I think directly exposing OpenXR enums can make sense in the situations were we are effectively directly exposing the OpenXR API, for example, via `OpenXRStructureBase` and its children. Or, even on the extension wrapper classes, when those are meant to be the lower-level interface.
> 
> However, for anything that the average developer who just wants to use spatial entity functionality has to interact with, I think this will be confusing. Especially once all the vendor extensions start appearing.
> 
> For example, right now we've got:
> 
> - `XR_SPATIAL_PLANE_SEMANTIC_LABEL_WALL_EXT`
> - `XR_SPATIAL_PLANE_SEMANTIC_LABEL_TABLE_EXT`
> 
> ... but this list could get expanded when vendor extensions add (hypothetical) items like:
> 
> - `XR_SPATIAL_PLANE_SEMANTIC_LABEL_SCREEN_META`
> - `XR_SPATIAL_PLANE_SEMANTIC_LABEL_WINDOW_BD`
> - `XR_SPATIAL_PLANE_SEMANTIC_LABEL_SHELF_ANDROID`
> 
> I think for higher-level stuff, our tendency is to hide these sort of things behind friendlier interfaces. Although, figuring out where to draw the line between low-level and high-level can be tricky too.
> 
> So, yeah, something we will need to continue to discuss! Probably would be easiest in a call or at an XR team meeting


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
