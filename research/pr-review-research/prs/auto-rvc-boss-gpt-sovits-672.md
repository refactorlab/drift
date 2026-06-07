# RVC-Boss/GPT-SoVITS #672 — T2S model inference optimization

**[View PR on GitHub](https://github.com/RVC-Boss/GPT-SoVITS/pull/672)**

| | |
|---|---|
| **Author** | @GoHomeToMacDonal |
| **Status** | ✅ merged |
| **Opened** | 2024-03-04 |
| **Repo importance** | ★58,399 · 6,391 forks · score 88,462 |
| **Diff** | +191 / −54 across 1 files |
| **Engagement** | 15 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @RVC-Boss — 3 reactions  
`👍 3`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-2206724169)

> 刚才验了下
> torchscript版本
> 控制种子的话，第一遍合成的结果，2倍加速版和baseline结果完全一样的
> 准备合进main了

### @WatchTower-Liu — 2 reactions  
`👍 2`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-1978045776)

> The GPT model used is so small that inference on high-performance Gpus is difficult to create performance bottlenecks. More of the performance bottleneck should be in the performance of the iteration itself. In this process, high-performance Gpus are difficult to fully load.

### @wehos — 2 reactions  
`👍 2`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-1979576767)

> > > **Hi, great work! I've verified it on my local RTX4090 card and it boosts the throughput from 55it/s to 85it/s on the same server.**
> > > Regarding your reported gap between windows and Linux servers, I have a relevant observation. On another RTX4090 card server, with **identical docker image (ubuntu-cuda12.1-cudnn8) and gpu cards**, it achieves 140it/s. I realized that the inference speed might also be subject to other hardware factors, e.g., cpu and motherboard. Anyway, the improvement on the same server is significant. Thanks again for the great work!
> > > ======Update 1=====
> > > Although the throughput diplayed by `tqdm` has a large gap, the overall inference speed is consistent across servers. Probably the gap across platforms (and servers) is due to the timing error for CUDA asynchronous operations.
> > > ======Update 2=====
> > > With **the same docker image (ubuntu-cuda12.1-cudnn8)**, another RTX3090-TI server is x2 faster than RTX4090. Looks like the CPU plays an important role here...
> > > Benchmark results (20 runs) with the same system and software environment on different hardwares:
> > > RTX4090 + X99 + Xeon® E5-2686: `80it/s` RTX4090 + ROG CROSSHAIR + AMD Ryzen 9 5900x: `195it/s` RTX4090 + ROME2d32gm + AMD EPYC 7662: `100it/s` RTX4090 + B650 LiveMixer + AMD Ryzen 9 7900X: **`400it/s`** RTX3090Ti + ROG Strix + AMD Ryzen 9 5900x: `230it/s`
> > > It seems GPU is not the major bottleneck for current online inference. ~If anyone can achieve higher throughput than `230it/s` with RTX4090, I would be interested to know the system setting.~
> > 
> > Thanks for you comprehensive … *[truncated]*

### @wehos — 1 reactions  
`👀 1`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-1977634210)

> **Hi, great work! I've verified it on my local RTX4090 card and it boosts the throughput from 55it/s to 85it/s on the same server.** 
> 
> Regarding your reported gap between windows and Linux servers, I have a relevant observation. On another RTX4090 card server, with **identical docker image (ubuntu-cuda12.1-cudnn8) and gpu cards**, it achieves 140it/s. I realized that the inference speed might also be subject to other hardware factors, e.g., cpu and motherboard. Anyway, the improvement on the same server is significant. Thanks again for the great work!
> 
> ======Update 1=====
> 
> Although the throughput diplayed by `tqdm` has a large gap, the overall inference speed is consistent across servers. Probably the gap across platforms (and servers) is due to the timing error for CUDA asynchronous operations.
> 
> ======Update 2=====
> 
> With **the same docker image (ubuntu-cuda12.1-cudnn8)**, another RTX3090-TI server is x2 faster than RTX4090. Looks like the CPU plays an important role here...
> 
> Benchmark results (20 runs) with the same system and software environment on different hardwares:
> 
> RTX4090 + X99 + Xeon® E5-2686: `80it/s`
> RTX4090 + ROG CROSSHAIR + AMD Ryzen 9 5900x: `195it/s`
> RTX4090 + ROME2d32gm + AMD EPYC 7662: `100it/s`
> RTX4090 + B650 LiveMixer + AMD Ryzen 9 7900X: **`400it/s`**
> RTX3090Ti + ROG Strix + AMD Ryzen 9 5900x: `230it/s`
> 
> It seems GPU is not the major bottleneck for current online inference. ~If anyone can achieve higher throughput than `230it/s` with RTX4090, I would be interested to know the system setting.~

### @RVC-Boss — 1 reactions  
`🎉 1`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-1981091939)

> @GoHomeToMacDonal @wehos Excellent! In my machine, there is approximately 50% acceleration.
> I will merge it, and welcome to explore more acceleration techniques!
> 
> 3090+i5-13490F+py39+win10-19045.4046-22H2
> 
> torch2.0.0+cu118+original code:
> 39%GPU+100%CPU(Single threaded)
> 0.118   0.032   3.328   0.220
> AR:112it/s
> 
> torch2.2.1+cu118+original code:
> 47%GPU+100%CPU(Single threaded)
> 0.117   0.031   3.056   0.320
> AR:117it/s
> 
> torch2.2.1+cu118+flash_attn version(but I installed flash_attn failed)(b64cd1e5156c7d176534ca4016f89499f6acba11):
> 55%GPU+100%CPU(Single threaded)
> 0.113   0.033   2.190   0.340
> AR:164it/s
> 
> ![image](https://github.com/RVC-Boss/GPT-SoVITS/assets/129054828/936ee61a-fc0a-4abe-bf0c-bab13a0458c6)

### @GoHomeToMacDonal — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/672#issuecomment-1977793322)

> > Hi, great work! I've verified it on my local RTX4090 card and it boosts the throughput from 55it/s to 85it/s.
> > 
> > Regarding your reported gap between windows and Linux servers, I have a relevant observation. On another RTX4090 card server, with **identical docker image (ubuntu-cuda12.1-cudnn8) and gpu cards**, it achieves 140it/s. I realized that the inference speed might also be subject to other hardware factors, e.g., cpu and motherboard. Anyway, the improvement on the same server is significant. Thanks again for the great work!
> > 
> > ======Update 1=====
> > 
> > Although the throughput diplayed by `tqdm` has a large gap, the overall inference speed is consistent across servers. Probably the gap across platforms (and servers) is due to the timing error for CUDA asynchronous operations.
> > 
> > ======Update 2=====
> > 
> > With **the same docker image (ubuntu-cuda12.1-cudnn8)**, another RTX3090-TI server is x2 faster than RTX4090. Looks like the motherboard plays an important role here...
> 
> Which version of PyTorch and Flash Attention are you used in your docker image? In addition, as ts2 model samples the results, it usually costs different time with the same input.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
