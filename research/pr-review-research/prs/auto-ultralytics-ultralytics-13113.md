# ultralytics/ultralytics #13113 — `ultralytics 8.2.38` official YOLOv10 support

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/13113)**

| | |
|---|---|
| **Author** | @Burhan-Q |
| **Status** | ✅ merged |
| **Opened** | 2024-05-24 |
| **Repo importance** | ★58,053 · 11,149 forks · score 107,648 |
| **Diff** | +785 / −32 across 23 files |
| **Engagement** | 36 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @Laughing-q — 19 reactions  
`❤️ 4 · 🎉 7 · 🚀 4 · 👀 4`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2133326803)

> @glenn-jocher @Burhan-Q ok guys this PR is ready from my side. :)
> I added a new arg `end2end`(by default it's `False`) and now all the yolo models(yolov8/yolov9/yolov10) are able to be nms-free.
> ```python
> from ultralytics import YOLO
> 
> model = YOLO("yolov8n.yaml")
> model = YOLO("yolov9c.yaml")
> model = YOLO("yolov10n.yaml")
> 
> model.train(data="coco128.yaml", epochs=1, end2end=True)
> model.val(end2end=True)
> model.predict(end2end=True)
> model.export(format="onnx", end2end=True)
> ```
> **Notes**: 
> - To distinguish nms-free from one-to-many models,  `end2end=True` should explicitly be applied for all the modes(train/val/predict/export) when trying to experience the nms-free pipeline.
> - For consistency between yolov10 and yolov8/yolov9, even though yolov10 is natively nms-free, it still needs to explicitly apply `end2end=True`. Another benefit of this is that we also support one-to-many version of yolov10(just apply `end2end=False`).
> For example, loading official yolov10 pretrained weights and do inference/validation/exporting:
> ```python
> from ultralytics import YOLO
> 
> model = YOLO("yolov10n.pt")
> model.predict(end2end=True)
> model.val(data="coco128.yaml", end2end=True)
> model.export(format="onnx", end2end=True)
> model.export(format="engine", end2end=True)
> 
> # End2end inference and validation with onnx and engine formats
> model = YOLO("yolov10n.onnx", task="detect")
> model = YOLO("yolov10n.engine", task="detect")
> model.predict(end2end=True)
> model.val("coco128.yaml", end2end=True)
> ```

### @Burhan-Q — 9 reactions  
`👍 3 · 🎉 3 · 🚀 3`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2143258897)

> YOLOv8-e2e `n`, `s`, `l`, and `x` models added to assets. The `m` model started later so it has ~80 more epochs to complete

### @Burhan-Q — 7 reactions  
`🚀 7`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2174260716)

> @glenn-jocher all conflicts are resolved and checks are passing. I believe this is ready for your review.

### @Burhan-Q — 4 reactions  
`👍 1 · 🚀 2 · 👀 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2130424291)

> @Laughing-q I tried to include what seemed straight forward from the source repo (started from `8d9f45a` as subsequent changes looked minimal). I didn't get to everything and was thinking some of the ones I didn't touch yet would be _very_ likely to change. I also added some doc strings on what was included here.
> 
> <details><summary>Files not yet added or changed</summary>
> <p>
> 
> - ultralytics/__init__.py
> - ultralytics/cfg/__init__.py
> - ultralytics/engine/exporter.py
> - ultralytics/engine/trainer.py
> - ultralytics/engine/validator.py
> - ultralytics/models/__init__.py
> - ultralytics/models/yolo/detect/val.py
> - ultralytics/models/yolov10/__init__.py
> - ultralytics/models/yolov10/model.py
> - ultralytics/models/yolov10/predict.py
> - ultralytics/models/yolov10/train.py
> - ultralytics/models/yolov10/val.py
> - ultralytics/nn/modules/__init__.py
> - ultralytics/nn/tasks.py
> - ultralytics/utils/loss.py
> - ultralytics/utils/tal.py
> - ultralytics/utils/torch_utils.py
> 
> </p>
> </details>

### @Laughing-q — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2134673732)

> @jameslahm Thanks for the information! I've updated it in https://github.com/ultralytics/ultralytics/pull/13113/commits/3b7e007feac660716bc1182d7ddec6f9b485c1bd.

### @johnnynunez — 3 reactions  
`👀 3`  ·  [link](https://github.com/ultralytics/ultralytics/pull/13113#issuecomment-2130335747)

> yolov10s is interesting for edge devices


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
