# RVC-Boss/GPT-SoVITS #721 — tts infer重构优化和批量推理支持

**[View PR on GitHub](https://github.com/RVC-Boss/GPT-SoVITS/pull/721)**

| | |
|---|---|
| **Author** | @ChasonJiang |
| **Status** | ✅ merged |
| **Opened** | 2024-03-08 |
| **Repo importance** | ★58,399 · 6,391 forks · score 88,462 |
| **Diff** | +2495 / −579 across 13 files |
| **Engagement** | 15 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @ChasonJiang — 1 reactions  
`🎉 1`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-2034885188)

> > 了解了，多谢！我看 fast_inference 是有相关代码的。但是pr标题是merge到main分支。这个是因为pr一开始提的是main分支，但后面更换了目标分支为fast_inference，所以导致pr提示的merge分支不准确么？
> 
> 是的

### @ChasonJiang — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-1986924516)

> # Update
> - 修复了t2s模型无prompt输入时引起的bug。
> - 支持了分段返回音频。
> - 优化了网页布局，并添加了一些功能选项。
> 
> ![image](https://github.com/RVC-Boss/GPT-SoVITS/assets/46401978/bf196b4a-08c4-48a8-8856-a4fe25d886c3)

### @leiyuyh — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-1987115321)

> 批量推理是指能同时接收多个推理指令（并发？）；
> 还是说在单个推理中，运用了某种模型能力加快单个推理的生成速度？

### @ChasonJiang — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-1987116901)

> > 批量推理是指能同时接收多个推理指令（并发？）； 还是说在单个推理中，运用了某种模型能力加快单个推理的生成速度？
> 
> 就是朴实无华的并行计算。在用CUDA之类的计算加速卡，以一个batch_size的大小的张量进行并行计算时，会更快一点，获得几乎成倍的提升。

### @leiyuyh — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-1987117810)

> > > 批量推理是指能同时接收多个推理指令（并发？）； 还是说在单个推理中，运用了某种模型能力加快单个推理的生成速度？
> > 
> > 就是朴实无华的并行计算。在用CUDA之类的计算加速卡，以一个batch_size的大小的张量进行并行计算时，会更快一点，获得几乎成倍的提升。
> 
> 懂了，感谢解答；
> 那就是我理解的加快单个推理的生成速度

### @X-T-E-R — 0 reactions  
`—`  ·  [link](https://github.com/RVC-Boss/GPT-SoVITS/pull/721#issuecomment-1987221437)

> 如果设置"return_fragment": True,会报错
> ```
> Traceback (most recent call last):
>   File "e:\AItools\GPT-SoVITS-Inference\runtime\lib\site-packages\werkzeug\serving.py", line 362, in run_wsgi
>     execute(self.server.app)
>   File "e:\AItools\GPT-SoVITS-Inference\runtime\lib\site-packages\werkzeug\serving.py", line 325, in execute
>     for data in application_iter:
>   File "e:\AItools\GPT-SoVITS-Inference\runtime\lib\site-packages\werkzeug\wsgi.py", line 256, in __next__
>     return self._next()
>   File "e:\AItools\GPT-SoVITS-Inference\runtime\lib\site-packages\werkzeug\wrappers\response.py", line 32, in _iter_encoded
>     for item in iterable:
>   File "e:\AItools\GPT-SoVITS-Inference\runtime\lib\site-packages\flask\helpers.py", line 113, in generator
>     yield from gen
>   File "E:\AItools\GPT-SoVITS-Inference\Inference\src\inference_core.py", line 132, in get_streaming_tts_wav
>     for chunk in chunks:
>   File "E:\AItools\GPT-SoVITS-Inference\Inference\src\inference_core.py", line 104, in inference
>     yield next(tts_pipline.run(inputs))
>   File "E:\AItools\GPT-SoVITS-Inference\GPT_SoVITS\TTS_infer_pack\TTS.py", line 620, in run
>     yield self.audio_postprocess(batch_audio_fragment,
>   File "E:\AItools\GPT-SoVITS-Inference\GPT_SoVITS\TTS_infer_pack\TTS.py", line 654, in audio_postprocess
>     audio = np.concatenate(audio, 0)
>   File "<__array_function__ internals>", line 180, in concatenate
> ValueError: zero-dimensional arrays cannot be concatenated
> 2.598   0.004   1.040   2.202
> ```
> 
> 因为
> ![image](https://github.com/RVC-Boss/GPT-SoVITS/assets/82741331/60ba6191-06be-4df5-b50a-fc0dee14cb75)
> 这里的batch audi … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
