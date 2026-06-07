# AUTOMATIC1111/stable-diffusion-webui #16030 — Stable Diffusion 3 support

**[View PR on GitHub](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030)**

| | |
|---|---|
| **Author** | @AUTOMATIC1111 |
| **Status** | ✅ merged |
| **Opened** | 2024-06-16 |
| **Repo importance** | ★163,453 · 30,371 forks · score 288,635 |
| **Diff** | +2058 / −72 across 24 files |
| **Engagement** | 75 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @tritant — 8 reactions  
`🎉 8`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2211710511)

> https://stability.ai/news/license-update

### @S4f3tyMarc — 3 reactions  
`👍 1 · 👀 2`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2172847602)

> @AUTOMATIC1111 Thanks for adding this! Looking forward to full implementation. Can you add img2img? It's not working right now.

### @protector131090 — 2 reactions  
`👍 2`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2171367795)

> 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 20/20 [00:01<00:00, 11.80it/s]
> *** Error completing request
> *** Arguments: ('task(5kbarr62htczn7w)', <gradio.routes.Request object at 0x0000012DF24243D0>, '', '', [], 1, 1, 7, 512, 512, False, 0.7, 2, 'Latent', 0, 0, 0, 'Use same checkpoint', 'Use same sampler', 'Use same scheduler', '', '', [], 0, 20, 'DPM++ 2M', 'Automatic', False, '', 0.8, -1, False, -1, 0, 0, 0, False, 'MultiDiffusion', False, True, 1024, 1024, 96, 96, 48, 4, 'None', 2, False, 10, 1, 1, 64, False, False, False, False, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 0.4, 0.4, 0.2, 0.2, '', '', 'Background', 0.2, -1.0, False, 'DemoFusion', False, 128, 64, 4, 2, False, 10, 1, 1, 64, False, True, 3, 1, 1, True, 0.85, 0.6, 4, False, False, 3072, 192, True, True, True, False, False, False, 'positive', 'comma', 0, False, False, 'start', '', 1, '', [], 0, '', [], 0, '', [], True, False, False, False, False, False, False, 0, False) {}
>     Traceback (most recent call last):
>       File "C:\sd.webui\SD3\webui\modules\call_queue.py", line 58, in f
>         res = list(func(*args, **kwargs))
>       File "C:\sd.webui\SD3\we … *[truncated]*

### @protector131090 — 2 reactions  
`❤️ 1 · 😄 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2171392420)

> --disable-nan-check --precision half  Fixed it for me!

### @greasebig — 2 reactions  
`😄 2`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2172465640)

> what is the problem?
> <img width="1388" alt="image" src="https://github.com/AUTOMATIC1111/stable-diffusion-webui/assets/121388156/295df7ae-5e69-4488-8072-e09b4076d351">

### @silvertuanzi — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16030#issuecomment-2171579613)

> > This triggers anytime I enter a prompt
> > 
> > File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\gradio\routes.py", line 488, in run_predict output = await app.get_blocks().process_api( File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\gradio\blocks.py", line 1431, in process_api result = await self.call_function( File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\gradio\blocks.py", line 1103, in call_function prediction = await anyio.to_thread.run_sync( File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\anyio\to_thread.py", line 33, in run_sync return await get_asynclib().run_sync_in_worker_thread( File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\anyio_backends_asyncio.py", line 877, in run_sync_in_worker_thread return await future File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\anyio_backends_asyncio.py", line 807, in run result = context.run(func, *args) File "C:\SD\stable-diffusion-webui\SD3\venv\lib\site-packages\gradio\utils.py", line 707, in wrapper response = f(*args, **kwargs) File "C:\SD\stable-diffusion-webui\SD3\modules\call_queue.py", line 14, in f res = func(*args, **kwargs) File "C:\SD\stable-diffusion-webui\SD3\modules\ui.py", line 185, in update_token_counter token_count, max_length = max([model_hijack.get_prompt_lengths(prompt) for prompt in prompts], key=lambda args: args[0]) File "C:\SD\stable-diffusion-webui\SD3\modules\ui.py", line 185, in token_count, max_length = max([model_hijack.get_prompt_lengths(prompt) for prompt in prompts], key=lambda args: args[0]) File "C:\SD\stable-diff … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
