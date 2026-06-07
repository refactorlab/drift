# RVC-Boss/GPT-SoVITS #2076 — 更新对amd显卡的支持

**[View PR on GitHub](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076)**

| | |
|---|---|
| **Author** | @luckykevvv |
| **Status** | ✅ merged |
| **Opened** | 2025-02-18 |
| **Repo importance** | ★58,399 · 6,391 forks · score 88,462 |
| **Diff** | +57 / −2 across 1 files |
| **Engagement** | 18 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @Rafa00127 — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2665610013)

> 还有一点要说，之前也有人提到了
> s1_train.py和s2_train.py中使用“nccl”的部分要改成"gloo"

### @KamioRinn — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2666167916)

> 是通过install.sh安装后操作的吗，在install加个检测，如果是AMD直接安装rocm版本是否更妥当？

### @luckykevvv — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2667577116)

> 好建议，我已经做了更改。现在会检查是否存在cuda环境，不存在的话检查rocm。都不存在则会自动安装cpu版。同时也会针对wsl做出检测并加上独特的额外指令。

### @luckykevvv — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2667582593)

> 有一点需要考虑的是，如果使用 pytorch==2.1.1 torchvision==0.16.1 torchaudio==2.1.1 . 本版本对rocm的支持只到5.6。新显卡并不支持过老的版本。在最新版6.2中可能会有兼容性问题，因此我将amd的版本该为torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1。

### @KamioRinn — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2667750276)

> > 有一点需要考虑的是，如果使用 pytorch==2.1.1 torchvision==0.16.1 torchaudio==2.1.1 . 本版本对rocm的支持只到5.6。新显卡并不支持过老的版本。在最新版6.2中可能会有兼容性问题，因此我将amd的版本该为torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1。
> 
> 不影响，2.6也能正常跑。脚本里是2.1是因为一直没去更新脚本。

### @KamioRinn — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/2076#issuecomment-2667751458)

> > 好建议，我已经做了更改。现在会检查是否存在cuda环境，不存在的话检查rocm。都不存在则会自动安装cpu版。同时也会针对wsl做出检测并加上独特的额外指令。
> 
> 优秀，readme也改回来？


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
