# hiyouga/LlamaFactory #7537 — [model] Add Qwen2.5-Omni

**[View PR on GitHub](https://github.com/hiyouga/LlamaFactory/pull/7537)**

| | |
|---|---|
| **Author** | @Kuangdd01 |
| **Status** | ✅ merged |
| **Opened** | 2025-03-30 |
| **Repo importance** | ★71,922 · 8,790 forks · score 112,075 |
| **Diff** | +348 / −2 across 10 files |
| **Engagement** | 87 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @Kuangdd01 — 4 reactions  
`👍 3 · 🚀 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-2918761306)

> > 你好，如果现在要使用图音对进行训练，输出为text，数据的格式是什么样子的？能否提供一个样例呢？感谢感谢
> 
> https://github.com/hiyouga/LLaMA-Factory/blob/main/data/mllm_video_audio_demo.json, 参考以上数据进行构造
> ``` json
> {
>     "messages": [
>       {
>         ++"content": "<image><audio>What is the video describing?",
>         "role": "user"
>       },
>       {
>         "content": "A girl who is drawing a picture of a guitar and feel nervous.",
>         "role": "assistant"
>       }
>     ],
>     ++"images": [
>       ++"mllm_demo_data/4.jpg"
>     ],
>     "audios": [
>       "mllm_demo_data/4.mp3"
>     ]
> },
> ```

### @Kuangdd01 — 3 reactions  
`👍 3`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-2827827550)

> > Do we support zero3 for qwen2.5omni? Error occured when patitioning parameters:
> > 
> > ```
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/models/auto/auto_factory.py", line 571, in from_pretrained
> > [rank0]:     return model_class.from_pretrained(
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/models/qwen2_5_omni/modeling_qwen2_5_omni.py", line 4406, in from_pretrained
> > [rank0]:     model = super().from_pretrained(
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/modeling_utils.py", line 283, in _wrapper
> > [rank0]:     return func(*args, **kwargs)
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/modeling_utils.py", line 4385, in from_pretrained
> > [rank0]:     model = cls(config, *model_args, **model_kwargs)
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/deepspeed/runtime/zero/partition_parameters.py", line 511, in wrapper
> > [rank0]:     f(module, *args, **kwargs)
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/models/qwen2_5_omni/modeling_qwen2_5_omni.py", line 4370, in __init__
> > [rank0]:     self.enable_talker()
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/transformers/models/qwen2_5_omni/modeling_qwen2_5_omni.py", line 4374, in enable_talker
> > [rank0]:     self.token2wav = Qwen2_5OmniToken2WavModel(self.config.token2wav_config)
> > [rank0]:   File "/opt/conda/lib/python3.10/site-packages/deepspeed/runtime/zero/partition_parameters.py", line 511, in wrapper
> > [rank0]:     f(module, *args, **kwargs)
> > [rank0]:   File "/opt/conda/l … *[truncated]*

### @Kuangdd01 — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-2774588665)

> > After running according to the above configuration, the error is as follows `TypeError: Qwen2_5OmniPreTrainedModelForConditionalGeneration.get_rope_index() got an unexpected keyword argument 'second_per_grids'` , how to solve it?
> 
> There have been several new changes since this PR. Try to use the latest code of `Llama-facotry` and `pip install git+https://github.com/Kuangdd01/transformers.git@qwen25omni` for transformers for now.

### @hiyouga — 2 reactions  
`👍 2`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-3027236209)

> @crystalww 若遇到类似 `ValueError("Processor was not found, please check and update your model file.")` 的报错，请运行下面的代码并且粘贴完整报错信息：
> 
> ```python
> from transformers import AutoProcessor
> 
> processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
> ```

### @Z-MU-Z — 1 reactions  
`👀 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-2781422835)

> Hello, I meet this error, do you know how to solve it?
> > > Then try the official inference pipeline:
> > > ```python
> > > import soundfile as sf
> > > from io import BytesIO
> > > from urllib.request import urlopen
> > > from qwen_vl_utils import process_vision_info
> > > from transformers import Qwen2_5OmniProcessor, Qwen2_5OmniModel
> > > 
> > > model_path = "./merged_model_checkpoint"
> > > 
> > > model = Qwen2_5OmniModel.from_pretrained(model_path, torch_dtype="auto", device_map="auto") 
> > > processor = Qwen2_5OmniProcessor.from_pretrained(model_path)
> > > from qwen_omni_utils import process_mm_info
> > > 
> > > conversation1 = [
> > >         {'role': 'system', 'content': 'You are Qwen, a virtual human developed by the Qwen Team, Alibaba Group, capable of perceiving auditory and visual inputs, as well as generating text and speech.'},
> > >         {"role": "user", "content": [
> > >             {"type": "text", "text": "Who are you?"},
> > >         ]},
> > > ]
> > > conversations = [conversation1]
> > > 
> > > text = processor.apply_chat_template(conversations, add_generation_prompt=True, tokenize=False)
> > > audios, images, videos = process_mm_info(conversations, use_audio_in_video=False)
> > > inputs = processor(text=text, audios=audios, images=images, videos=videos, return_tensors="pt", padding=True, use_audio_in_video=False)
> > > inputs = inputs.to(model.device).to(model.dtype)
> > > text_ids, audio = model.generate(**inputs, use_audio_in_video=False)
> > > text = processor.batch_decode(text_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)
> > > print(text)
> > > sf.write(
> > >     "output.wav",
> > … *[truncated]*

### @Z-MU-Z — 1 reactions  
`👍 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7537#issuecomment-2783605633)

> hello, I solve this bug by following https://github.com/QwenLM/Qwen2.5-Omni/issues/110, 
> namely I changed device_map="auto" to device_map="balanced", It seems that 4090 don't support device_map="auto"  for Qwen2.5Omni, but I don't know why


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
