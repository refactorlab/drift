# Comfy-Org/ComfyUI #7063 — MultiGPU Work Units For Accelerated Sampling (CORE-184)

**[View PR on GitHub](https://github.com/Comfy-Org/ComfyUI/pull/7063)**

| | |
|---|---|
| **Author** | @Kosinkadink |
| **Status** | ✅ merged |
| **Opened** | 2025-03-04 |
| **Repo importance** | ★115,766 · 13,547 forks · score 174,952 |
| **Diff** | +1683 / −248 across 16 files |
| **Engagement** | 93 conversation · 23 inline review comments |

## Top review comments (ranked by reactions)

### @bedovyy — 5 reactions  
`👍 5`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2732105976)

> confirmed working basic SDXL T2I on 2x Arc B580, using torch2.6.1 + intel extension 2.6.10.
> | &nbsp; | it/s | time taken |
> |---|---|---|
> | 1xB580 | 3.68 | 8.92 |
> | 2xB580 | 6.58 | 5.64 |
> 
> it is about 58% boosted.
> 
> And I ran WAN2.1 I2V 480P from ComfyUI Examples, but change dtype to fp8e5m2,
> I had to use `--disable-ipex-optimize` option and the below envs.
> (I don't know what's going on...)
> 
> ```
> # Configure oneAPI environment variables.
> source /opt/intel/oneapi/setvars.sh
> 
> # Recommended Environment Variables for optimal performance
> export USE_XETLA=OFF
> export SYCL_CACHE_PERSISTENT=1
> # [optional] under most circumstances, the following environment variable may improve performance, but sometimes this may also cause performance degradation
> export SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS=1
> ```
> 
> | &nbsp; | s/it | time taken |
> |---|---|---|
> | 1xB580 | 15.44 | 338.39 |
> | 2xB580 | 8.39 | 178.14 |
> 
> it's about 90% boosted.

### @wywywywy — 5 reactions  
`👍 5`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2793471924)

> Wan 2.1 I2V 480p (fp8 & q8)
> Python 3.12
> PyTorch 2.8
> CUDA 12.8
> SageAttention 2.1.1
> Dual 3090
> WSL2 Ubuntu 22
> Everything up to date as of 10th April
> 
> | Node | Works? |
> |---|---|
> | Native Diffusion Loader| ✅ |
> | Native GGUF Loader | ✅ |
> | KJ SLG | ❌ |
> | KJ TeaCache | ⚠️ No crash but degraded |
> | Native SLG | ⚠️ Works but much slower |
> | Official TeaCache | ❌ |
> | KJ Torch Compile | ❌ |
> | Native Torch Compile | ❌ |
> 
> KJ TeaCache doesn't work together with Native SLG, but it's kind of expected.
> 
> When it works, the performance is amazing. It's nearly twice as fast!
> 
> I didn't run into any OOM situation like @Oruli though.
> 
> Workflow attached.
> 
> [WanVideo_I2V_test_multigpu.json](https://github.com/user-attachments/files/19685945/WanVideo_I2V_test_multigpu.json)

### @hhaishen — 4 reactions  
`👍 4`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2700903903)

> Brother, first of all, I have to thank you—this is a great PR! I have four T4 GPUs, but each T4 only has 16GB of VRAM. When I run my workflow, I often encounter out-of-memory (OOM) issues on a single GPU, while the other three GPUs remain unused because ComfyUI does not support distributed processing. Can your MultiGPU feature allow me to utilize the other three GPUs as well? I don’t mind sacrificing some performance as long as I can run my workflow without hitting OOM errors.

### @riscy768 — 4 reactions  
`👍 4`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2816375164)

> > @riscy768 it should work for everything - if you got a black image, that means something went wrong in terms of compatibility with something in the workflow. in my testing, when this happens, you should get your console log spammed with some error every single step. Could you create and link a workflow that has the issue? (And potentially send the logs from console). Thanks!
> 
> I'll decompose this into the simplest use case that can be easily repeatable with as few customizations as necessary.  I'm an IT guy so I get the value of smallest meaningful use cases.  Thanks for the quick reply :)

### @Kosinkadink — 3 reactions  
`👍 3`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2708689765)

> @hhaishen The Work Units feature accelerates sampling, meaning each device gets its own copy of the model weights to run - it does not add any functionality to distribute portions of weights to run on other devices.
> 
> There will be a PR in the future that addresses that use case.

### @Kosinkadink — 3 reactions  
`👍 3`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7063#issuecomment-2743790352)

> @without-ordinary ComfyUI-MultiGPU sorta 'does its own thing' with model/memory management, so it likely does something that is incompatible with the ComfyUI model management system. The code is very abstracted in that node pack, but 10 minutes or so of looking into it, I'd wager it has something to do with ComfyUI-MultiGPU having a global 'current_device' variable it updates.
> 
> Do you use ComfyUI-MultiGPU mostly to tell VAE, CLIP etc. to be loaded on some of your auxiliary GPUs? That functionality can be easily extended into core ComfyUI (the ModelPatcher object just needs to have load_device set to something that isn't the default torch device). I talked with comfy briefly about the demand for this feature, and its implementation boils down to deciding how to expose it to the user.
> 
> I can look into adding that functionality soon. Ideally I'd want it to work for base checkpoints as well and make the MultiGPU Work Units node 'just work' with it, but at the minimum I could easily make VAE and CLIP be loaded and do their work on non-primary devices as there are no core nodes that at the top of my head would clash with that.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
