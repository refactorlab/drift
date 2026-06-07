# ultralytics/ultralytics #18484 — `ultralytics 8.3.67` NMS Export for Detect, Segment, Pose and OBB YOLO models

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/18484)**

| | |
|---|---|
| **Author** | @Y-T-G |
| **Status** | ✅ merged |
| **Opened** | 2025-01-01 |
| **Repo importance** | ★58,053 · 11,149 forks · score 107,648 |
| **Diff** | +326 / −214 across 17 files |
| **Engagement** | 72 conversation · 34 inline review comments |

## Top review comments (ranked by reactions)

### @Laughing-q — 4 reactions  
`👍 2 · 🚀 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2609063048)

> @glenn-jocher ok this PR is ready to me.
> I updated the cleanup code a bit to reduce duplication by creating two functions called `construct_result` and `construct_results` to construct the returned `Results`. This way for tasks like pose and obb we just re-write the `construct_result` function. Ideally for future tasks Predictor we just need to re-write `construct_result` and put every modification within it.
> @Y-T-G Also I noticed that `tflite` with nms does not work with pose task(boxes are good but no keypoints come out), fixed in https://github.com/ultralytics/ultralytics/pull/18484/commits/7a3f857665225cb308414874f46284f69c0bf9fa.

### @inisis — 2 reactions  
`👍 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2568760516)

> @Y-T-G @Laughing-q It works for me
> ```
> onnx                         1.17.0
> onnx-graphsurgeon            0.5.2
> onnx2tf                      1.22.3
> onnxconverter-common         1.14.0
> onnxruntime                  1.19.2
> onnxslim                     0.1.44
> ```
> 
> ```
> (base) root@desmond-1024:~# yolo export format=onnx model=yolo11n.pt nms=True
> Ultralytics 8.3.57 🚀 Python-3.10.15 torch-2.5.1+cpu CPU (Intel Xeon Platinum 8378C 2.80GHz)
> YOLO11n summary (fused): 238 layers, 2,616,248 parameters, 0 gradients, 6.5 GFLOPs
> 
> PyTorch: starting from 'yolo11n.pt' with input shape (1, 3, 640, 640) BCHW and output shape(s) (1, 84, 8400) (5.4 MB)
> 
> ONNX: starting export with onnx 1.17.0 opset 19...
> ONNX: slimming with onnxslim 0.1.44...
> ONNX: export success ✅ 1.4s, saved as 'yolo11n.onnx' (10.3 MB)
> 
> Export complete (1.7s)
> Results saved to /root
> Predict:         yolo predict task=detect model=yolo11n.onnx imgsz=640  
> Validate:        yolo val task=detect model=yolo11n.onnx imgsz=640 data=/usr/src/ultralytics/ultralytics/cfg/datasets/coco.yaml  
> Visualize:       https://netron.app
> 💡 Learn more at https://docs.ultralytics.com/modes/export
> VS Code: view Ultralytics VS Code Extension ⚡ at https://docs.ultralytics.com/integrations/vscode
> (base) root@desmond-1024:~# yolo predict task=detect model=yolo11n.onnx imgsz=640
> WARNING ⚠️ 'source' argument is missing. Using default 'source=/root/miniconda3/lib/python3.10/site-packages/ultralytics/assets'.
> Ultralytics 8.3.57 🚀 Python-3.10.15 torch-2.5.1+cpu CPU (Intel Xeon Platinum 8378C 2.80GHz)
> Loading yolo11n.onnx for ONNX Runtime inference...
> Using ONNX … *[truncated]*

### @Y-T-G — 2 reactions  
`👍 2`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2625122552)

> > We should make sure this is documented because from a YOLO perspective, this is "non-standard" format as far as I know.
> > 
> > I would have expected `Class X Y W H Conf [KPX1 KPY1 KPConf...]` like all other Yolo (v8 at least) outputs.
> 
> It's the standard output for end2end models like YOLOv10 and RTDETR. NMS included models are akin to end2end models.

### @Y-T-G — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2568730577)

> > Because the most experience of embedding nms into model is a bit more complicated, like the way yolov7 repo did they have additional EfficientNMS_TRT module that is injected into onnx model during exporting, while in this PR implementation we directly inject the pytorch ops before exporting onnx.
> So I guess this is related to the versions of onnx and/or onnxruntime? probably there are some updates they introduced recently allows us to directly inject torchvision.ops.nms op? what's your onnx and onnxruntime version?
> 
> Yeah, I thought it was complicated too but I recently discovered `torchvision.ops.nms` works correctly, even with an old opset like 14. Maybe it's not as fast as the dedicated one like EfficientNMS_TRT.

### @inisis — 1 reactions  
`🚀 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2568755288)

> > ```shell
> > yolo predict task=detect model=yolo11n.onnx imgsz=640
> > yolo export format=onnx model=yolo11n.pt nms=True
> > ```
> 
> This is related to onnxslim, I will check it asap.

### @Y-T-G — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/18484#issuecomment-2568774350)

> > @Y-T-G I guess this PR is still WIP right? I tried:
> > ```bash
> > yolo predict task=detect model=yolo11n.onnx imgsz=640
> > yolo export format=onnx model=yolo11n.pt nms=True
> > ```
> > but encountered this error:
> > ```bash
> > Traceback (most recent call last):
> >   File "/home/laughing/anaconda3/bin/yolo", line 8, in <module>
> >     sys.exit(entrypoint())
> >              ^^^^^^^^^^^^
> >   File "/home/laughing/codes/ultralytics/ultralytics/cfg/__init__.py", line 973, in entrypoint
> >     getattr(model, mode)(**overrides)  # default args from model
> >     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> >   File "/home/laughing/codes/ultralytics/ultralytics/engine/model.py", line 558, in predict
> >     return self.predictor.predict_cli(source=source) if is_cli else self.predictor(source=source, stream=stream)
> >            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> >   File "/home/laughing/codes/ultralytics/ultralytics/engine/predictor.py", line 188, in predict_cli
> >     for _ in gen:  # sourcery skip: remove-empty-nested-block, noqa
> >   File "/home/laughing/anaconda3/lib/python3.11/site-packages/torch/utils/_contextlib.py", line 36, in generator_context
> >     response = gen.send(None)
> >                ^^^^^^^^^^^^^^
> >   File "/home/laughing/codes/ultralytics/ultralytics/engine/predictor.py", line 239, in stream_inference
> >     self.model.warmup(imgsz=(1 if self.model.pt or self.model.triton else self.dataset.bs, 3, *self.imgsz))
> >   File "/home/laughing/codes/ultralytics/ultralytics/nn/autobackend.py", line 732, in warmup
> >     self.forward(im)  # warmup
> >     ^^^^^^^^^^^^^^^^
> >   File "/home/laughing/co … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
