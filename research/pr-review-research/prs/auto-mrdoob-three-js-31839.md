# mrdoob/three.js #31839 — SSGINode: New node for screen-space global illumination.

**[View PR on GitHub](https://github.com/mrdoob/three.js/pull/31839)**

| | |
|---|---|
| **Author** | @Mugen87 |
| **Status** | ✅ merged |
| **Opened** | 2025-09-07 |
| **Repo importance** | ★112,854 · 36,386 forks · score 263,396 |
| **Diff** | +848 / −0 across 7 files |
| **Engagement** | 46 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @Maksims — 6 reactions  
`👍 6`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3263970578)

> This looks cool.
> But the demo is scene used is missleading, as it has lightmaps with baked GI in them.
> To present the technique in its actual quality, it is best to use scene with dynamic lights and shadow maps, but without lightmaps.

### @zalo — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3277211516)

> Considering a Cornell Box since it very succinctly shows the benefits of AO+GI and it looks nice with the settings dialed in:
> ![CornellBoxComparison2](https://github.com/user-attachments/assets/842845ad-9591-40cf-abc9-a56dc25b11d8)
> 
> (Here's the lit frame at full color depth)
> <img width="695" height="514" alt="image" src="https://github.com/user-attachments/assets/1f6e9a44-a13e-4b39-bfb8-7654b9acfb69" />
> 
> <details>
> <summary><b>Cornell Box Scene Code</b></summary>
> 
> ```js
> // Walls
> let geo = new THREE.PlaneGeometry(1, 1);
> let mat = new THREE.MeshPhysicalMaterial({ color: "#ff0000" });
> let mesh = new THREE.Mesh(geo, mat);
> mesh.scale.set( 20, 15, 1 );
> mesh.rotation.y = Math.PI * 0.5;
> mesh.position.set(-10, 7.5, 0);
> mesh.receiveShadow = true;
> scene.add(mesh);
> 
> mat = new THREE.MeshPhysicalMaterial({ color: "#00ff00" });
> mesh = new THREE.Mesh(geo, mat);
> mesh.scale.set( 20, 15, 1 );
> mesh.rotation.y = Math.PI * -0.5;
> mesh.position.set(10, 7.5, 0);
> mesh.receiveShadow = true;
> scene.add(mesh);
> 
> mat = new THREE.MeshPhysicalMaterial({ color: "#fff" });
> mesh = new THREE.Mesh(geo, mat);
> mesh.scale.set( 20, 20, 1 );
> mesh.rotation.x = Math.PI * -.5;
> mesh.receiveShadow = true;
> scene.add(mesh);
> 
> mesh = new THREE.Mesh(geo, mat);
> mesh.scale.set( 15, 20, 1 );
> mesh.rotation.z = Math.PI * -0.5;
> mesh.position.set(0, 7.5, -10);
> mesh.receiveShadow = true;
> scene.add(mesh);
> 
> mesh = new THREE.Mesh(geo, mat);
> mesh.scale.set( 20, 20, 1 );
> mesh.rotation.x = Math.PI * 0.5;
> mesh.position.set(0, 15, 0);
> mesh.receiveShadow = true;
> scene.add(mesh);
> 
> // Tall Box
> geo = new THREE.BoxGeometry(5, 7, 5);
> mesh = new THRE … *[truncated]*

### @zalo — 5 reactions  
`❤️ 3 · 🚀 1 · 👀 1`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3272023456)

> Ahh, so the source of the major discrepancy was that it was falling back to WebGL when I did local development without https (and I guess in other weird contexts); it seems like there's something in here that breaks when emitting GLSL.   When forced to https, it uses WebGPU and everything looks as expected.
> 
> Secondly, I think I found the AO bug!   When I change the `PI` on this line to `PI2`, everything looks beautiful and non-flickery:
> https://github.com/mrdoob/three.js/blob/9f3ff3cff81b244a9af790d1a445c4acd57d2606/examples/jsm/tsl/display/SSGINode.js#L571
> 
> I'm not sure why, since that correlates with this line which still has it as `PI`:
> https://github.com/cdrinmatane/SSRT3/blob/main/HDRP/Shaders/Resources/SSRTCS.compute#L348
> 
> Sorry for the compression making it rough...
> 
> https://github.com/user-attachments/assets/be780f33-213d-4bcd-bc13-9125e7a1850f

### @zalo — 4 reactions  
`👍 1 · ❤️ 1 · 🎉 2`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3275638930)

> Here's the latest comparison between the two implementations, both set to 4 slices and 32 samples (other settings adjusted to be similar style):
> ![SSGIvsSSILVB](https://github.com/user-attachments/assets/e7c05966-4475-49e4-959c-55784f74f4ef)
> 
> The smoother/nicer one is the fixed SSGI 😄 I no longer think that the incremental improvement from GT-VBAO will make a huge difference...
> 
> Now there are just a couple smearing issues with the TRAA to solve... and I might commit some extra changes to the scene.   The "Neutral Tonemapping" and Exposure set to 1.5 is crushing out a lot of the detail, and the "pre-baked" lighting room is hiding a lot of the benefit 😄

### @zalo — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3276429354)

> As far as the demo scene goes... the current room is a crime compared to some of these other models
> 
> Spaceship Hallway shows off both the AO and the GI really well, since it has no baked in lighting (this is JUST the SSGI postprocess):
> ![SSGIComparison](https://github.com/user-attachments/assets/7f4fd97d-b800-453b-8c29-c63d0adcea4a)
> 
> EDIT: This scene does not look nearly as good when the GI compositing is fixed.   Guess it was just lucky.
> 
> I'll look into making a custom demo scene to show it off in a few hours...

### @zalo — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/mrdoob/three.js/pull/31839#issuecomment-3277028309)

> Aha, I've got a fix
> 
> Just need to swap out:
> ```js
> const compositePass = vec4( add( scenePassColor.rgb, gi ).mul( ao ), scenePassColor.a );
> ```
> for:
> ```js
> const compositePass = vec4( scenePassColor.rgb.mul( ao ).add( scenePassDiffuse.rgb.mul(gi)), scenePassColor.a );
> ```
> ![SponzaLightBugFix](https://github.com/user-attachments/assets/cca5a6aa-0898-4bd9-9b2a-2c09719ca7e5)
> 
> I'll make a PR for it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
