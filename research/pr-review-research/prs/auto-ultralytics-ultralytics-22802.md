# ultralytics/ultralytics #22802 — `ultralytics 8.3.236` add Axelera export for YOLO on Metis AIPU

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/22802)**

| | |
|---|---|
| **Author** | @ambitious-octopus |
| **Status** | ✅ merged |
| **Opened** | 2025-11-25 |
| **Repo importance** | ★58,053 · 11,149 forks · score 107,648 |
| **Diff** | +334 / −61 across 11 files |
| **Engagement** | 19 conversation · 66 inline review comments |

## Top review comments (ranked by reactions)

### @glenn-jocher — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3641804767)

> @ambitious-octopus @lakshanthad @onuralpszr @a-tangfan PR approved and merged!!

### @a-tangfan — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3636683405)

> Can we please put "FAQ" before "Summary" and have "About This Release" at the bottom of the doc? The doc reads weird to me with the current organization.

### @onuralpszr — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3641761404)

> > I'm not able to click the approve button, but I am happy to **approve**. I appreciate all your efforts and cooperation, especially in this tight schedule. (Lakshantha is almost working from day to night - I've talked with him several times in his late evening... really appreciate your time, and also thanks for Francesco for leading the integration).
> 
> Thank you so much behalf of my colleagues and friends @ambitious-octopus and @lakshanthad to we made it through. It was great team effort and work. Thank you so much again.

### @lakshanthad — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3592423339)

> @ambitious-octopus I have added the following:
> 
> - Put all exported files under `_axelera_model` directory
> - Implement metadata passing to handle class names
> 
> Please check

### @a-tangfan — 1 reactions  
`👀 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3636669152)

> `WARNING ⚠️ Axelera: >300 images recommended for INT8 calibration, found 4 images.` <--- this message is wrong when running `yolo export` minimal is 100

### @onuralpszr — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/22802#issuecomment-3637891898)

> I also saw some warning from axelera and can you confirm are they okay (just double checking) 
> 
> Update: @lakshanthad told me it is fine. 
> 
> ```console
> WARNING ⚠️ Dataset 'coco128.yaml' images not found, missing path '/root/datasets/coco128/images/train2017'
> Downloading https://ultralytics.com/assets/coco128.zip to '/root/datasets/coco128.zip': 100% ━━━━━━━━━━━━ 6.7MB 47.4MB/s 0.1s
> Unzipping /root/datasets/coco128.zip to /root/datasets/coco128...: 100% ━━━━━━━━━━━━ 263/263 3.2Kfiles/s 0.1s
> Dataset download success ✅ (0.7s), saved to /root/datasets
> 
> Downloading https://ultralytics.com/assets/Arial.ttf to '/root/.config/Ultralytics/Arial.ttf': 100% ━━━━━━━━━━━━ 755.1KB 23.8MB/s 0.0s
> Fast image access ✅ (ping: 0.0±0.0 ms, read: 1290.1±585.6 MB/s, size: 35.4 KB)
> Scanning /root/datasets/coco128/labels/train2017... 126 images, 2 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 128/128 1.0Kit/s 0.1s
> New cache created: /root/datasets/coco128/labels/train2017.cache
> WARNING ⚠️ Axelera: >300 images recommended for INT8 calibration, found 128 images.
> Configuration of node '/model.10/m/m.0/attn/Reshape' may not be supported. 'Reshape' parameters:
> 	allowzero: 0
> 	data: Metadata(shape=(1, 256, 20, 20), is_constant=False)
> 	shape: Metadata(shape=(4,), is_constant=True)
> 	reshaped: Metadata(shape=(1, 2, 128, 400), is_constant=False)
> 'Reshape' parameters do not match supported configuration: allowzero == 0 and np.array_equal(shape, data.shape)
> 'Reshape' parameters do not match supported configuration: allowzero == 0 and len(data.shape) >= 2 and len(shape) == 2 and shape[0] == data.shape[0] and (shape[1] … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
