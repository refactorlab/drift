# godotengine/godot #102987 — [LinuxBSD] Add support for HDR output (Wayland)

**[View PR on GitHub](https://github.com/godotengine/godot/pull/102987)**

| | |
|---|---|
| **Author** | @ArchercatNEO |
| **Status** | ✅ merged |
| **Opened** | 2025-02-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +2310 / −24 across 14 files |
| **Engagement** | 176 conversation · 132 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @Zamundaaa — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-2672918828)

> > If the Compositor implements color-management-v1 then yes
> 
> It also needs to support parametric image descriptions, and the primaries and transfer function you want to use. Ofc if you use Vulkan to set the colorspace and HDR metadata, the Vulkan driver also has to support them.
> 
> > If the Compositor doesn't implement color-management then vulkan APIs may still be able to handle it but unless it's far easier than I think to get information from Vulkan it doesn't seem practical.
> 
> You can output HDR content with Vulkan, but it doesn't (yet) actually have any API to figure out what the compositor is asking for / what the display is capable of.
> 
> > Does the Screen (Wayland output, PC monitor) support HDR? First obtain a wp_color_management_output.
> 
> Please don't do that. Outside of special cases, the color management output should *not* be used.
> 
> HDR support should only be determined by whether or not the compositor supports it, the display isn't really relevant beyond the luminance ranges (which you can get from the preferred image description). If you output scRGB or BT2020PQ, the compositor will do the needed transformations to make it work on any display.
> 
> KWin for example does proper HDR on SDR laptops (as proper as the displays can do at least); while the primary use case for that is HDR videos, it would be cool if that would work with games too.
> 
> If you want to ensure that you don't waste power presenting HDR content when it's not necessary, you can instead check if the preferred image description has a maximum target luminance that's higher than the reference luminance. If … *[truncated]*

### @deralmas — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-2669505360)

> > If you don't mind @Riteo I'd also like to get your feedback on this specially with where to put the more stateful stuff like the compositors prefered icc profile.
> 
> Yea sure! :D
> 
> I'm currently very busy with a thing I'm working on but I could not resist taking a very quick look at the protocol.
> 
> I can't really comment on the feature itself as I have very little experience with HDR. That said, the logic you're describing seems great! My only concern is how much the godot-side API depends on the screen since 99% of Wayland stuff revolves around windows, with the screen being a way smaller piece of context compared to traditional servers.
> 
> Regarding the data layout, the general rule of thumb is to put all state for an object in an aptly-named `*State` class, which you'll need to bind anyways to the object so that it can be accessed by the handler. Even the "global" data you're talking about is still bound to an object, so it becomes quite easy to see where I'm going.
> 
> Actually, you don't even need to make a "global" variable in the thread class; a common approach I've chosen is to consider the objects themselves... objects, and just `malloc` their state in the user_data. See the `*_get_*_state` classes and the way their objects are handled.
> 
> So you could just do an:
> 
> ```cpp
> 	ColorManagerState *state = wp_color_manager_get_state(the_actual_color_manager_proxy);
> 	if (state) {
> 		// Stuff!
> 	}
> ```
> 
> And always have a valid state reference. If you implement it like the other methods, it will also automatically check for `whatever` to not be null and whether it's properly "tagged" (a … *[truncated]*

### @Zamundaaa — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-2997250912)

> > But I do want to emphasize that display hardware and operating systems will typically apply tonemapping because they expect that the content cannot dynamically change to adapt to the reference and max luminance of the system. But in the case of Godot, we can and do dynamically adapt. So our goal is to bypass all operating system and display tonemapping when possible. Is there a way to disable system tonemapping with KDE Plasma?
> 
> You tell the compositor what HDR metadata you're targeting, and it decides based on that whether or not tone mapping for some use cases is necessary. If reference luminance and HDR metadata match with the preferred image description though, you can expect there to be no tone mapping (aside from edge cases like an SDR screencast, but that's not really relevant here).
> 
> > From these comments it sounds like the only way the compositor will not apply tonemapping is if godot were to support targeting the native primaries of the monitor and it's transfer function not just the closest colorspace + transfer function which the current state PR is unable to do.
> 
> That was just about encoding of the data, tonemapping is a separate thing and doesn't depend on the transfer function or primaries. Converting to a different encoding is generally very cheap and doesn't change the image.

### @Zamundaaa — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-2997406654)

> Hmm, that made me notice a rather big flaw with the PR as-is: Vulkan doesn't actually have any way (yet) to communicate your reference luminance to the system. This doesn't just cause tone mapping, but causes brightness levels to be wrong in general because the compositor will map from the default reference luminance to the one it's using, but you're not using the default reference.
> 
> Longer term it would be best if you go directly through Wayland for setting the image description and set the reference luminance... but as you currently only support HDR10 / BT2020+PQ, you can work around the issue in a simple way: PQ has a default reference of 203 in the Wayland protocol, so you can multiply min and max luminance values by `203 / reference_lum`, and set sdr_white to 203 to get the appropriate values and avoid tone mapping.
> 
> > in terms of the protocol it doesn't look like we have any ways to prevent the compositor from transforming our image, we can only comply with the preferred surface and trust the compositor to maintain fidelity
> 
> Correct.

### @ArchercatNEO — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-2997452655)

> > Longer term it would be best if you go directly through Wayland for setting the image description and set the reference luminance...
> 
> Then I guess there will have to be some more significant changes. Earliest godot 4.6-dev1 could happen is still at least a month away so if we'll eventually need to do this anyway better to get it out of the way before hdr v1 is merged and we have a more stable api to maintain. While workarounds are helpful, in this situation I think it would be best to go the full length to ensure no upstream API additions are necessary.

### @ArchercatNEO — 1 reactions  
`👍 1`  ·  [link](https://github.com/godotengine/godot/pull/102987#issuecomment-3015073604)

> > It's possible the low precision buffer could be faster than the high precision buffer on Linux once that stuff has been resolved(?)
> 
> It's very likely that that's true yeah. I don't know if the godot fps counter is affected by compositor side transformations but if it is then this is likely just the tonemapper slowing things down.
> 
> I will mention out of everything we make use of the *only* thing that wayland does not provide is the data format/prefer high precision. On my machine the compositor said (implictly) we should be using HDR10 by suggesting BT.2020 primaries and ST 2084 (PQ). I don't know if the colorspace is enough to infer the data format but either way it seemed less important because as far as I'm aware a colorspace inconsistency just means a performance loss (because the compositor needs to transform it again) while a luminance inconsisenty leads to loss of fidelity with the originial output.
> 
> I won't go as far as to suggest that if the suggested colorspace is an HDR colorspace we should enable HDR automatically because the choice of SDR/HDR should still be configurable. But technically if the compositor prefers HDR and we supply sRGB we can be pretty confident performance will be lost from the compositor converting sRGB to whatever HDR format the display actually needs.
> 
> Again what the wayland protocol requires is that our metadata is correct. Even if we cannot yet fully implement all colorspaces as long as we are accurate with the one we use the purpose of the compositor is to fill in the gaps and transform the output to whatever the native colorspace of th … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
