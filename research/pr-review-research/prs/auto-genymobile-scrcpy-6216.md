# Genymobile/scrcpy #6216 — Migrate from SDL2 to SDL3

**[View PR on GitHub](https://github.com/Genymobile/scrcpy/pull/6216)**

| | |
|---|---|
| **Author** | @rom1v |
| **Status** | ✅ merged |
| **Opened** | 2025-07-11 |
| **Repo importance** | ★143,036 · 13,192 forks · score 200,707 |
| **Diff** | +1081 / −842 across 47 files |
| **Engagement** | 42 conversation · 37 inline review comments |

## Top review comments (ranked by reactions)

### @rom1v — 5 reactions  
`👍 2 · ❤️ 1 · 🎉 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3701838119)

> You can test the latest version of this PR (branch `sdl3.36`) built here: https://github.com/rom1v/scrcpy/actions/runs/20615612335

### @rom1v — 4 reactions  
`👍 1 · ❤️ 1 · 🎉 1 · 🚀 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3697831083)

> @anotheruserofgithub Thank you very much for your review. :+1:
> 
> I fixed most of them. I will investigate the remaining ones (especially https://github.com/Genymobile/scrcpy/pull/6216#discussion_r2651810005).
> 
> > L17 there is a `sc_gamepad_processor` too.
> 
> I added a separate commit.
> 
> > L326 the migration guide has been moved to https://wiki.libsdl.org/SDL3/README-migration (hyphen instead of slash). But maybe you should now point to the actual documentation / wiki page? No longer need to refer to the SDL2 -> SDL3 transition.
> 
> I removed the comment, it was only necessary when the named differred from SDL.
> 
> > (changes in `scrcpy/.github/workflows/release.yml`)
> 
> These ones must still refer to SDL2:
>  - the old Ubuntu version used does not package SDL3
>  - this is necessary (at least, this is an easy way) to install the SDL dependencies required to build a working static binary

### @rom1v — 3 reactions  
`👍 1 · ❤️ 1 · 🎉 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3288531073)

> I updated the PR to not assume that the SDL SAMPLES_FRAMES hint is honored (refs https://github.com/libsdl-org/SDL/issues/13397). @yume-chan this should fix https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3072768615.
> 
> @adamponi The vulkan driver issue is fixed: https://github.com/libsdl-org/SDL/issues/13734
> 
> > Does it bring any other benefits besides hardware acceleration of video decoding and DirectX 11, 12, Vulkan rendering?
> 
> Besides hardware acceleration (which requires some work), the main benefit is to use a version of SDL that will continue to evolve (not become abandoned/deprecated).

### @rom1v — 3 reactions  
`👍 1 · 🎉 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3696349315)

> I think it's going to be time to migrate to SDL3. I plan to merge this branch into `dev` soon.
> 
> If you want to test, a release of this branch is available here (built by Github Actions): https://github.com/rom1v/scrcpy/actions/runs/20572157206

### @rom1v — 3 reactions  
`👍 1 · ❤️ 1 · 🚀 1`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3708095567)

> This PR is ready to be merged. :rocket: 
> 
> Here are binaries for the latest version: https://github.com/rom1v/scrcpy/actions/runs/20693631961

### @icculus — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/Genymobile/scrcpy/pull/6216#issuecomment-3073463585)

> Not awake yet, but I'll try the Windows build today and see what happens.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
