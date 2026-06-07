# mrdoob/three.js #31640 — Examples: Add TSL Procedural Wood Material

**[View PR on GitHub](https://github.com/mrdoob/three.js/pull/31640)**

| | |
|---|---|
| **Author** | @SeeleyLogan |
| **Status** | ✅ merged |
| **Opened** | 2025-08-13 |
| **Repo importance** | ★112,854 · 36,386 forks · score 263,396 |
| **Diff** | +835 / −0 across 5 files |
| **Engagement** | 37 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @bhouston — 5 reactions  
`❤️ 4 · 👀 1`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3184445941)

> Nice work @SeeleyLogan.  But yeah, the compile times are brutal.  @sunag do you have an idea on how to make this performant given they are all basically the same material, just different parameters?
> 
> BTW what is really nice about this material is that it is fully 3D:
> 
> <img width="265" height="529" alt="Screenshot 2025-08-13 at 12 13 49 PM" src="https://github.com/user-attachments/assets/6c2cef47-623e-4cf9-b70d-c73fff584224" />

### @SeeleyLogan — 4 reactions  
`🎉 4`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3189072384)

> @Mugen87 It looks like I've fixed the aliasing issue. As the camera moves away, the sharp wood rings get blurred and the cell structure becomes smaller. There are a couple distances where the anti-aliasing breaks down slightly; nothing too noticeable.

### @bhouston — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3216118116)

> @mrdoob, I've fixed the PR to only have the key files included (cherrying picked all the important commits and force-pushed), refactored the example to make it cleaner and also demonstrate how to create custom wood materials, and not limit it to only presets.
> 
> CC: @SeeleyLogan

### @SeeleyLogan — 3 reactions  
`🚀 3`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3192217600)

> @cmhhelgeson I've converted all instances of `wgslFn` to proper `Fn`.

### @bhouston — 3 reactions  
`👍 3`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3193020021)

> @hybridherbst wrote:
> 
> > I think incremental loading just covers the fact that compilation is slow, I'd opt for removing it and loading everything at the same time (as a typical application would do).
> 
> > We're also seeing very slow compile times with TSL (regular MeshPhysicalMaterial is ~50-100x slower to create and compile on WebGPURenderer vs. WebGLRenderer), so I think instead of covering it up this should stay as-is and compilation times hopefully improved at some point in the underlaying system.
> 
> We are of course seeing that as well with this wood texture.  It is incredibly slow on mobile devices.  So much that I am scared to deploy it to production use.
> 
> Should I create a Github issue for that?  We could use this example as a test case.

### @bhouston — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/mrdoob/three.js/pull/31640#issuecomment-3188746009)

> Redid the scene and added incremental loading:
> 
> ![output](https://github.com/user-attachments/assets/fc22b002-1c27-43b1-99d2-cfbefca13012)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
