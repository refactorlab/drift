# Comfy-Org/ComfyUI #13408 — feat: SAM (segment anything) 3.1 support (CORE-34)

**[View PR on GitHub](https://github.com/Comfy-Org/ComfyUI/pull/13408)**

| | |
|---|---|
| **Author** | @kijai |
| **Status** | ✅ merged |
| **Opened** | 2026-04-14 |
| **Repo importance** | ★115,766 · 13,547 forks · score 174,952 |
| **Diff** | +3502 / −1 across 9 files |
| **Engagement** | 52 conversation · 20 inline review comments |

## Top review comments (ranked by reactions)

### @drphero — 2 reactions  
`👍 2`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4256448731)

> The SAM3 Detect node doesn't seem to be able to mask more than one object of the same type. The threshold, refine_iterations, and individual_masks settings do not seem to have an effect on this.
> 
> EDIT: Serves me right for adding the nodes by hand and then hunting down [this line](https://github.com/kijai/ComfyUI/blob/30a73b3aac69a807af672dd5a52e5893e9e22132/comfy/text_encoders/sam3_clip.py#L43) instead of just loading the example workflow. However, it does not seem to behave like the note says. "cake:2, apron" is supposed to find two cakes and all aprons, but in the pictured hat example, "hat" only ever finds one hat. I had to up the number to hat:3. That returned two hats masked. Significantly lowering the threshold got me all 3. The linked line of code seems to automatically set the max to 1 unless specified. Maybe [this line](https://github.com/kijai/ComfyUI/blob/30a73b3aac69a807af672dd5a52e5893e9e22132/comfy_extras/nodes_sam3.py#L38) too?
> 
> <img width="1288" height="670" alt="SCR-20260416-cnoq" src="https://github.com/user-attachments/assets/06dedf78-3ebe-4a1d-ad03-34d278b1e5ec" />
> 
> <img width="1368" height="708" alt="SCR-20260416-czze" src="https://github.com/user-attachments/assets/65b738f4-04bb-4c03-984b-1bc66c28312d" />

### @Kosinkadink — 1 reactions  
`🎉 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4251092404)

> Tested this PR, seems to work well. Code looks good.

### @jimsmt — 1 reactions  
`👍 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4303808134)

> > @kijai glad to see it merges finally!
> > 
> > I tried this in my video, but failed with person mask.... only mask in first frame. Maybe a little bug here or due to model capbility it self?
> > 
> > video is here: https://github.com/user-attachments/assets/feea0a3d-673f-4249-b003-4fa98d402f01
> > 
> > my workflow: <img alt="image" width="2000" height="1247" src="https://private-user-images.githubusercontent.com/128986336/582627160-f9f85ad0-6219-4a14-af4e-2946e6412190.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzY5NDE3MjYsIm5iZiI6MTc3Njk0MTQyNiwicGF0aCI6Ii8xMjg5ODYzMzYvNTgyNjI3MTYwLWY5Zjg1YWQwLTYyMTktNGExNC1hZjRlLTI5NDZlNjQxMjE5MC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwNDIzJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDQyM1QxMDUwMjZaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1iN2VmMzMwOTE5M2JiNTE0YjU2OWU3MWRkYmM3NTZjYmVkMjAyZjQwNDQyZDcxN2IzNDQ4OGQxYzQzZmRhOTljJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZyZXNwb25zZS1jb250ZW50LXR5cGU9aW1hZ2UlMkZwbmcifQ.yjBZVx9_IoXziLYX2GRLoa1tnZuB8L3MKHP8yO4R8xk">
> 
> I was having the same issue with you, after removing the `--use-sage-attention` parameter from ComfyUI startup command, it works as expected now

### @kijai — 1 reactions  
`👍 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4363404679)

> > I just did a test with the ComfyUI-Easy-SAM3 (I know, that's not 3.1) and that functions just fine with sage-attention enabled.
> 
> It doesn't use sageattention, it's hardcoded to use pytorch attention (sdpa).
> 
> > I just updated to the latest state of ComfyUI:master, so that should exclude missing code on my side.
> 
> I asked someone with AMD to test and they said it works fine, so it's not a generic AMD thing, are you using any other launch flags? Would also be helpful if you can run a basic test with `--disable-all-custom-nodes` to rule out any possible conflicts.

### @rong7932 — 0 reactions  
`—`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4248879913)

> > 对[Segment Anything 3](https://github.com/facebookresearch/sam3)的支持
> > 
> > 新增对SAM3和3.1型号的支持，包括多路复用视频跟踪。虽然两种型号都能支持这个PR，但在我的测试中，我觉得没必要用旧的SAM3模型权重，旧式无复用的跟踪方式适用于两个版本的模型。
> > 
> > 模型代码是ComfyUI的重新实现，无额外依赖，并针对单显卡优化。
> > 
> > 对于模型本身，Meta的[原始许可](https://huggingface.co/facebook/sam3.1/blob/main/LICENSE)适用。 https://huggingface.co/Comfy-Org/SAM3/blob/main/checkpoints/sam3.1_multiplex_fp16.safetensors
> > 
> > [SAM31_test.json](https://github.com/user-attachments/files/26729354/SAM31_test.json)
> > 
> > 视频跟踪：
> > 
> > * 用初始掩膜传播跟踪任意一种
> > * 文本条件检测追踪过程中的新物体或遮挡物体
> > * 廉价预览，无需实体化张量，直接转为临时视频文件，并叠加显示对象ID和评分
> > * 节点选择将哪个遮罩具体化为法向遮罩张量
> > * 位打包中间掩码格式以减少内存使用。
> > 
> > <img alt="图片" width="2000" height="1276" src="https://private-user-images.githubusercontent.com/40791699/578242950-481c23e6-0dc3-4a62-88cb-56f239dc6e7d.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzYyMjM0NjAsIm5iZiI6MTc3NjIyMzE2MCwicGF0aCI6Ii80MDc5MTY5OS81NzgyNDI5NTAtNDgxYzIzZTYtMGRjMy00YTYyLTg4Y2ItNTZmMjM5ZGM2ZTdkLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA0MTUlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNDE1VDAzMTkyMFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWZlNmUwZjY2ZDM3NDgyNTNhYWRjMzc1N2JjYzQxMzg3MDczN2Q3ZjUyOWExZGU2Mjc1OWQ2ZmFhNzE4YTM4NzcmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.T_A35tcXqBI_e6KpiS2wYxvx0w0PR3vOPKNxqAnXDJ8">
> > 图像分割：
> > 
> > * 支持bbox、积分、提示
> > * Refine 选项，重新运行检测，并以掩体作为输入
> > * 直接输出为掩码，可以是并集，也可以分别输出每个掩码
> > 
> > <img alt="图片 … *[truncated]*

### @kijai — 0 reactions  
`—`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/13408#issuecomment-4251058977)

> > What node is this? Why don't I have it even after updating to the latest version?
> 
> This is a pull request (PR), it's not merged to main, meaning that to test it you'd have to pull this specific PR yourself.
> 
> Or just wait until it's finished/approved.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
