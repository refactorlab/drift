# rasbt/LLMs-from-scratch #828 — `Qwen3Tokenizer` fix for Qwen3 Base models and generation mismatch with HF

**[View PR on GitHub](https://github.com/rasbt/LLMs-from-scratch/pull/828)**

| | |
|---|---|
| **Author** | @casinca |
| **Status** | ✅ merged |
| **Opened** | 2025-09-15 |
| **Repo importance** | ★96,688 · 14,787 forks · score 160,796 |
| **Diff** | +125 / −15 across 7 files |
| **Engagement** | 19 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @rasbt — 3 reactions  
`🎉 3`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3324829736)

> @casinca A little follow-up here:
> 
> So while Qwen3-Base is a pre-trained base model and the Qwen3 recommends using it without chat template, changing 
> 
> ```python
> tokenizer = Qwen3Tokenizer(tokenizer_file_path=tokenizer_path)
> ```
> 
> ```
> user
> You are a helpful math assistant.
> Answer the question and write the final result on a new line as:
> \boxed{ANSWER}
> 
> Question:
> Convert the point $(0,3)$ in rectangular coordinates to polar coordinates.  Enter your answer in the form $(r,\theta),$ where $r > 0$ and $0 \le \theta < 2 \pi.$
> 
> Answer:
> ```
> 
>  to 
> 
> ```python
> tokenizer = Qwen3Tokenizer(
>     tokenizer_file_path=tokenizer_path,
>     apply_chat_template=True
> )
> ```
> 
> ```
> <|im_start|>user
> You are a helpful math assistant.
> Answer the question and write the final result on a new line as:
> \boxed{ANSWER}
> 
> Question:
> Convert the point $(0,3)$ in rectangular coordinates to polar coordinates.  Enter your answer in the form $(r,\theta),$ where $r > 0$ and $0 \le \theta < 2 \pi.$
> 
> Answer:<|im_end|>
> ```
> 
> boosts the performance on a MATH-500 test subset substantially (30% -> 80%)
> 
> But yeah, it is not clear whether the MATH-500 test set was part of the training data; in the age of LLMs, I guess we can assume that any data available on the internet has been part of the training data and this chat template maybe somehow helps with memorization.

### @danielpmorton — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3294318653)

> While we're talking about Qwen tokenizers, there's a very minor issue in the [README](https://github.com/rasbt/LLMs-from-scratch/blob/main/ch05/11_qwen3/README.md#4-initialize-tokenizer) where the tokenizer for the base model should not have "-base" appended to the filename
> 
> ```
> from llms_from_scratch.qwen3 import Qwen3Tokenizer
> 
> if USE_REASONING_MODEL:
>     tok_filename = "tokenizer.json"    
> else:
>     tok_filename = "tokenizer-base.json"   # <-- Issue here, should just be "tokenizer.json"
> 
> tokenizer = Qwen3Tokenizer(
>     tokenizer_file_path=tok_filename,
>     repo_id=repo_id,
>     add_generation_prompt=USE_REASONING_MODEL,
>     add_thinking=USE_REASONING_MODEL
> )
> ```
> 
> Might be a nice thing to add to this PR since it's very related? Or could be a separate fix

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3294376371)

> @casinca I added the checking with and without applying the chat template here in the other repo, it should cover all the cases: https://github.com/rasbt/reasoning-from-scratch/pull/41
> 
> In general the tokenizer should not have the issue you described. Maybe the code diverged slightly between the code there and here. If the code in reasoning-model-from-scratch addresses your issue, what do you think about porting it 1:1 over to here to make things easier?

### @d-kleine — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3294532577)

> > In general, you are right, I think the Base model can (or should?) be used without the chat template. However, since once can add it via hugging face I also wanted to have support for that. Actually, on some prompts I think that it actually helps with performance if you add the chat template.
> > 
> > (Unfortunately, I couldn't find any information on how to use the Base models from the Qwen3 team; they only describe the Instruct and Thinking uses unless I overlooked something in the READMEs and model cards.)
> 
> I double-checked that and found this information: https://qwen.readthedocs.io/en/latest/getting_started/concepts.html#naming
> 
> Imo, it would be better to use the base model without a chat template.

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3294546290)

> @d-kleine Thanks, so
> 
> > -Base: the pre-trained models that do not know the predefined chat template, used for in-context learning, downstream fine-tuning, etc.
> 
> But at the same time, I think we can still allow adding this template (e.g., useful if someone wants to fine-tune the base model) similar to how HF does. So whether or not to use the template could be toggled via the `apply_chat_template=True/False` option of the tokenizer. 
> @danielpmorton
> 
> Good call, it makes sense to clean it up then as well. I have to double check what the download source is for the README version, because I added a `tokenizer-reasoning.json` (duplicate of `tokenizer.json`) to the from scratch HF repo to make the file names a bit more self-explanatory: https://huggingface.co/rasbt/qwen3-from-scratch/tree/main

### @danielpmorton — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/828#issuecomment-3299803222)

> @rasbt Ah, got it -- I think the difference was I was trying out the 4B model and downloading data directly from [Qwen's HF page](https://huggingface.co/Qwen/Qwen3-4B/tree/main) which has a different file naming convention than your 0.6B HF page
> 
> Thanks for making a great resource!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
