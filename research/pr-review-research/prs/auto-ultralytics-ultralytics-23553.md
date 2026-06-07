# ultralytics/ultralytics #23553 — `ultralytics 8.4.50` New Export Integration: Deepx 

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/23553)**

| | |
|---|---|
| **Author** | @ambitious-octopus |
| **Status** | ✅ merged |
| **Opened** | 2026-02-04 |
| **Repo importance** | ★58,053 · 11,149 forks · score 107,648 |
| **Diff** | +573 / −14 across 17 files |
| **Engagement** | 70 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @deepx-dgkim — 4 reactions  
`👍 2 · ❤️ 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-4368428445)

> Hi @lakshanthad & @ambitious-octopus ,
> 
> Sorry for the delayed response due to the long public holiday in Korea.
> Here are the current status updates.
> 
> - matplotlib issue: 
>   - status: WIP
>   - Reproduced the same issue on a Raspberry Pi 5
>   - Engineering team is investigating the root cause and a fix with top priority
> 
> - Debian package installation for x86_64 system:
>   - status: Done (in validation process)
>   - You can get this from DEEPX `staging` branch
>   - Where? https://github.com/DEEPX-AI/dx_rt/raw/refs/heads/staging/release/3.3.1/libdxrt_3.3.1_all.deb
>   - Plan: will release to the `main` branch after validation process
> 
> - dkms manual installation issue:
>   - status: WIP
>   - We will apply it by the end of this week. (target: by this Wednesday)
> 
> - Ultralytics export validation on several x86_64 systems:
>   - We will support verification on the devices listed below for this upcoming release. 
>   - However, please note that providing the same level of verification for every subsequent release may be difficult.
> 
> Test HW List:
> | Architecture | Processor/Hardware | OS |
> | :--- | :--- | :--- |
> | x86_64 | Intel | Ubuntu 20.04 |
> | x86_64 | Intel | Ubuntu 22.04 |
> | x86_64 | Intel | Ubuntu 24.04 |
> | x86_64 | Intel | Ubuntu 26.04 |
> | x86_64 | AMD | Ubuntu 20.04 |
> | x86_64 | AMD | Ubuntu 22.04 |
> | x86_64 | AMD | Ubuntu 24.04 |
> | aarch_64 | ROCK5BP | Debian 12 |
> 
> Thanks,
> Max Kim

### @lakshanthad — 2 reactions  
`👍 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-3947768143)

> @dx-maxkim Here are the python package changes that `dx-com` package brings in after installing on top of `ultralytics` package. We can start to prioritize which packages are bringing major conflicts based on this full list.
> cc @onuralpszr @ambitious-octopus 
> 
> python3.8
> 
> ```
> changed
> * nvidia-cudnn-cu12==9.1.0.70 -> nvidia-cudnn-cu12==8.9.2.26
> * onnx==1.17.0 -> onnx==1.16.1
> * opencv-python==4.13.0.92 -> opencv-python==4.10.0.84
> * protobuf==5.29.6 -> protobuf==3.20.2
> * torch==2.4.1 -> torch==2.3.0
> * torchvision==0.19.1 -> torchvision==0.18.0 
> * tqdm==4.67.3 -> tqdm==4.66.4
> * triton==3.0.0 -> triton==2.3.0 
> 
> new
> + Rtree==1.3.0
> + cloudpickle==3.1.1
> + coloredlogs==15.0.1
> + dx-com @ file:///home/lakshanthad/test/dx_com-2.2.0rc2-cp38-cp38-linux_x86_64.whl
> + humanfriendly==10.0
> + mypy==1.14.1
> + mypy_extensions==1.1.0
> + onnxruntime==1.18.0
> + ordered-set==4.1.0
> + pybind11==2.13.1
> + pycryptodome==3.20.0
> + sortedcontainers==2.4.0
> + tomli==2.4.0
> + torchaudio==2.3.0
> ```
> 
> python3.9
> 
> ```
> changed
> * nvidia-cublas-cu12==12.8.4.1 -> nvidia-cublas-cu12==12.1.3.1
> * nvidia-cuda-cupti-cu12==12.8.90 -> nvidia-cuda-cupti-cu12==12.1.105
> * nvidia-cuda-nvrtc-cu12==12.8.93 -> nvidia-cuda-nvrtc-cu12==12.1.105
> * nvidia-cuda-runtime-cu12==12.8.90 -> nvidia-cuda-runtime-cu12==12.1.105
> * nvidia-cudnn-cu12==9.10.2.21 -> nvidia-cudnn-cu12==8.9.2.26
> * nvidia-cufft-cu12==11.3.3.83 -> nvidia-cufft-cu12==11.0.2.54
> * nvidia-curand-cu12==10.3.9.90 -> nvidia-curand-cu12==10.3.2.106
> * nvidia-cusolver-cu12==11.7.3.90 -> nvidia-cusolver-cu12==11.4.5.107
> * nvidia-cusparse-cu12==12.5.8.93 -> nvidia-cusparse-cu12==12.1.0.1 … *[truncated]*

### @deepx-dgkim — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-3994927479)

> Hi @lakshanthad and @ambitious-octopus,
> 
> We have an internal discussion and decided to use PyPI in the future.
> 
> However, it will take several months due to the following reasons:
> - Package size limit: PyPI limit is less than 100M, but dx-com wheel size is about 350M
> - Internal legal review
> - Internal security review
> 
> In the meantime, we will provide a way to install without ID/PW for the next release.
> For example: `pip install dx_com -f https://sdk.deepx.ai/release/dxcom/v2.2.1rc3/index.html`
> 
> Thanks,
> Max Kim

### @deepx-dgkim — 2 reactions  
`👍 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-4134282614)

> Hi @lakshanthad and @ambitious-octopus,
> 
> Here is a dx-com v2.3.0 release candidate. (not official release)
> 
> `pip install dx-com -f https://sdk.deepx.ai/release/dxcom/v2.3.0/index.html`
> 
> We resolved a torch, torchvision, onnx version issue and x2 faster compile time than v2.2.x version.
> It is still under internal validation process, but I am sharing it with you early for a quick release. Please review it and give us your feedback.
> 
> Thanks, Max Kim

### @lakshanthad — 2 reactions  
`👍 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-4181478494)

> @dx-maxkim Good news!
> 
> I have fixed some minor issues on exporter side and now exporting to `deepx` using this branch works with all different YOLO26 tasks such as detection, segmentation, pose estimation, classfication and oriented bounding boxes.
> 
> I have also used these exported models and inference using your provided scripts and they all work!
> 
> Next, I will continue to implement autobackend inference on this branch for all other tasks. Currently, detection works.
> 
> cc: @ambitious-octopus

### @lakshanthad — 2 reactions  
`👀 1 · 😕 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23553#issuecomment-4294013254)

> @dx-maxkim Now all YOLO26 models work under the latest `dx-runtime v3.3.0` and `dx-engine v3.3.0`
> 
> <img width="auto" height="350" alt="pi@deepx~YOL011ultralytics $ dxrt-chi -s" src="https://github.com/user-attachments/assets/fba2bd75-36bc-4c38-b171-7092475da86d" />
> <img width="400" height="auto" alt="Screenshot 2026-04-21 at 10 20 23 PM" src="https://github.com/user-attachments/assets/1d33498b-bbe9-4f7f-bd89-2865633e010b" />
> 
> I have added `opt_level` as an argument to select during export.
> 
> ```
> yolo export model=yolo26n.pt opt_level=1
> ```
> 
> I have used `TASK2CALIBRATIONDATA` to choose default calibration datasets for the export to improve the accuracy after calibration.
> 
> - detect: coco128
> - segment: coco128-seg
> - classify: imagenet100
> - pose: coco8-pose
> - obb: dota128
> 
> I have also added runtime packages installation including `dx-engine` using six-fab method. However, this is only supported to run on Arm64 Trixie systems. It would be nice to have more Arm64 OS support and also X86 support.
> 
> As with validation, we are facing an issue.
> 
> ```
> (deepx-lakshantha) me@raspberrypi:~/repos/ultralytics $ yolo val model=yolo26n.pt
> WARNING ⚠️ 'data' argument is missing. Using default 'data=coco8.yaml'.
> Ultralytics 8.4.38 🚀 Python-3.13.5 torch-2.11.0+cpu CPU (aarch64)
> YOLO26n summary (fused): 122 layers, 2,408,932 parameters, 0 gradients, 5.4 GFLOPs
> val: Fast image access ✅ (ping: 0.0±0.0 ms, read: 2157.2±899.2 MB/s, size: 54.0 KB)
> val: Scanning /home/me/repos/datasets/coco8/labels/val.cache... 4 images, 0 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 4/4 621.4Kit/s 0.0s
>                  Cla … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
