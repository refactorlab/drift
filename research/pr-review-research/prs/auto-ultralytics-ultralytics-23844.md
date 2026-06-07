# ultralytics/ultralytics #23844 — `ultralytics 8.4.32` Expand Axelera exportable models and tasks

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/23844)**

| | |
|---|---|
| **Author** | @lakshanthad |
| **Status** | ✅ merged |
| **Opened** | 2026-03-09 |
| **Repo importance** | ★58,053 · 11,149 forks · score 107,648 |
| **Diff** | +777 / −208 across 21 files |
| **Engagement** | 38 conversation · 44 inline review comments |

## Top review comments (ranked by reactions)

### @lakshanthad — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4095253185)

> @onuralpszr @Laughing-q @ambitious-octopus Guys please help to review this PR.
> 
> Currently the compiler and runtime is using `rc2` version. Axelera team plans to release `rc3` tomorrow or early Monday which will be final release (`rc3` will get rid of `"numpy<2.0.0", "onnxruntime"` requirements on autobackend). So if everything is good after review is done , we can go for the merge on Monday or Tuesday along with a Ultralytics minor release version.
> 
> I have tested all models and all tasks. They are working as expected. Only YOLO26 segmentation models are not supported and they are expected to released on April. After this, we can enable the support for YOLO26 segmentation on benchmarks/ tests.

### @tamrobb — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4117078305)

> > 3. Our benchmarks CI after building Ubuntu-based x86 Docker images fail. So I have disabled it. Even though this fails, if I try to recreate this on a Linux x86 Docker environment locally, it passes.
> >    https://github.com/ultralytics/ultralytics/actions/runs/23464091755/job/68272365235
> 
> This seems to be because of auto-update of `axelera-devkit` on first use, leading to an unusable venv because of
> ```
>  - matplotlib==3.9.4
>  + matplotlib==3.10.8
> ```
> Presumably this would work on subsequent runs as per
> ```
> WARNING ⚠️ requirements: Restart runtime or rerun command for updates to take effect
> ```
> 
> Is there any mechanism for the CI to retry the run (possibly if it sees an autoupdate has happened)?
> (or do a pre-run of something where it doesn't care about success/fail?)

### @lakshanthad — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4120869648)

> > > 3. Our benchmarks CI after building Ubuntu-based x86 Docker images fail. So I have disabled it. Even though this fails, if I try to recreate this on a Linux x86 Docker environment locally, it passes.
> > >    https://github.com/ultralytics/ultralytics/actions/runs/23464091755/job/68272365235
> > 
> > This seems to be because of auto-update of `axelera-devkit` on first use, leading to an unusable venv because of
> > 
> > ```
> >  - matplotlib==3.9.4
> >  + matplotlib==3.10.8
> > ```
> > 
> > Presumably this would work on subsequent runs as per
> > 
> > ```
> > WARNING ⚠️ requirements: Restart runtime or rerun command for updates to take effect
> > ```
> > 
> > Is there any mechanism for the CI to retry the run (possibly if it sees an autoupdate has happened)? (or do a pre-run of something where it doesn't care about success/fail?)
> 
> I have pushed a potential workaround @tamrobb. Let's see how it goes:
> https://github.com/ultralytics/ultralytics/pull/23844/changes/64b3a2bf2ca8398cb58c77423d336946c1e8c907

### @lakshanthad — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4144252105)

> @Laughing-q You have missed the default calibration datasets when fixing conflicts. I have added it. Also I have moved it to the top. Having the logic inside `export_axelera()` block does not seem to work as expected.

### @lakshanthad — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4144724434)

> @a-tangfan @tamrobb We are close to merge. However, at the last minute, I just noticed `rc3` has issues only with classification models. `rc2` is working fine. WIth `rc3`, the below error is there at inference. Would really appreciate a fix here.
> 
> ```
> yolo predict task=classify model=yolo26n-cls_axelera_model imgsz=224 int8                                                                               ─╯
> WARNING ⚠️ 'source' argument is missing. Using default 'source=/home/lakshanthad/YOLO11/ultralytics/ultralytics/assets'.
> Ultralytics 8.4.24 🚀 Python-3.12.13 torch-2.10.0+cu128 CUDA:0 (NVIDIA GeForce RTX 3060, 11910MiB)
> 
> Traceback (most recent call last):
>   File "/home/lakshanthad/miniconda3/envs/axelera/bin/yolo", line 10, in <module>
>     sys.exit(entrypoint())
>              ^^^^^^^^^^^^
>   File "/home/lakshanthad/YOLO11/ultralytics/ultralytics/cfg/__init__.py", line 986, in entrypoint
>     getattr(model, mode)(**overrides)  # default args from model
>     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>   File "/home/lakshanthad/YOLO11/ultralytics/ultralytics/engine/model.py", line 536, in predict
>     return self.predictor.predict_cli(source=source) if is_cli else self.predictor(source=source, stream=stream)
>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>   File "/home/lakshanthad/YOLO11/ultralytics/ultralytics/engine/predictor.py", line 244, in predict_cli
>     for _ in gen:  # sourcery skip: remove-empty-nested-block, noqa
>              ^^^
>   File "/home/lakshanthad/miniconda3/envs/axelera/lib/python3.12/site-packages/torch/utils/_contextlib.py", line 40, in generator_context
>     respons … *[truncated]*

### @onuralpszr — 1 reactions  
`👍 1`  ·  [link](https://github.com/ultralytics/ultralytics/pull/23844#issuecomment-4154232461)

> My review and changes I applied (cc @Laughing-q @ambitious-octopus )
> 
> Code fixes:
>   - Fixed naming inconsistency: "Axelera" to "Axelera AI" in export_formats()
>   - Added "data" to the Axelera export arguments list (was missing despite being used for calibration)
>   - default_data[model.task] to .get(model.task, "coco128.yaml") to prevent KeyError on unknown tasks (safety)
>   - Preserved PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION env var, now saves/restores original value after export. This prevents side effects on other code that relies on protobuf (e.g. ONNX export) and ensures consistent behavior across exports.
>   - Removed outdated "requires runtime activation" from backend docstring (activation step was removed) (confirm via @ambitious-octopus) 
> 
>   Docs fixes:
>   - Updated reference docs SEO metadata: "ONNX to Axelera" to "PyTorch to Axelera" (export path changed from ONNX to torch)
>   - Added missing YOLO11 to integration page SEO keywords
>   - Fixed docstring filename typo in yolo11-seg.py: yolov11-seg.py to yolo11-seg.py
> 
>   Examples cleanup:
>   - Merged yolo26-pose.py into yolo26-pose-tracker.py. Eliminated heavy code duplication (+380 lines across 2 files to 240 lines in 1 file)
>   - Tracking is now optional via --tracker none for pose-only mode
>   - Updated README with Ultralytics branding, corrected examples table (3 scripts to 2), and updated arguments


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
