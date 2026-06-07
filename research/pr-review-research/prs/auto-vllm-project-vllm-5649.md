# vllm-project/vllm #5649 — [Feature] OpenAI-Compatible Tools API + Streaming for Hermes & Mistral models

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/5649)**

| | |
|---|---|
| **Author** | @K-Mistele |
| **Status** | ✅ merged |
| **Opened** | 2024-06-18 |
| **Repo importance** | ★81,996 · 17,677 forks · score 157,703 |
| **Diff** | +2588 / −83 across 26 files |
| **Engagement** | 171 conversation · 211 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @K-Mistele — 10 reactions  
`👍 2 · ❤️ 4 · 🎉 4`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2264545317)

> I think we are ready for review! I did notice that CI is failing the ruff checks though because many lines are "too long". I never had this problem before - is it a recent change, and do I need to adjust my code?
> 
> I'm happy to adjust, but 80 characters isn't a lot when dealing with highly nested code (9 levels of indentation in some places).

### @K-Mistele — 9 reactions  
`👍 2 · ❤️ 5 · 🚀 2`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2262151631)

> Final things:
> - [ ] resolve merge conflicts 
> - [ ] clean up logging and debugging print/logger calls

### @K-Mistele — 6 reactions  
`👍 6`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2177412298)

> Progress! I as of current commits, I can now get the hermes 2 pro model to generate a tool call using the  `--enable-auto-tool-choice` and `--tool-use-prompt-template` flags:
> 
> Server:
> ```shell
> python -m vllm.entrypoints.openai.api_server --model NousResearch/Hermes-2-Pro-Llama-3-8B --tool-use-prompt-template examples/tool_template_hermes_2_pro.jinja --enable-api-tools --enable-auto-tool-choice
> ```
> 
> Client:
> ```shell
> python examples/openai_chat_completion_client_with_tools.py
> ```
> 
> Result
> ```text
> Chat completion results:
> ChatCompletion(id='cmpl-1354f3f373574d7aa0e1bf0b78915188', choices=[Choice(finish_reason='stop', index=0, logprobs=None, message=ChatCompletionMessage(content='<tool_call>{"arguments": {"city": "Dallas", "state": "TX", "unit": "fahrenheit"}, "name": "get_current_weather"}</tool_call>', role='assistant', function_call=None, tool_calls=[]), stop_reason=None)], created=1718763539, model='NousResearch/Hermes-2-Pro-Llama-3-8B', object='chat.completion', system_fingerprint=None, usage=CompletionUsage(completion_tokens=33, prompt_tokens=367, total_tokens=400))
> ```
> 
> Now, working on getting it to work for non-streaming responses - then, streaming!

### @K-Mistele — 6 reactions  
`🚀 6`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2245544496)

> Planning to add Llama 3.1 tool call support as soon as the format is released

### @K-Mistele — 6 reactions  
`👍 2 · 🎉 2 · 🚀 2`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2266356857)

> I will work on fixing CI checks now, but would love to get some maintainer reviews in the meantime so we can get this merged :) I spent several hours resolving & debugging merge conflicts for the _second_ time this week and would love to not have to do that again as some of the issues were rather subtle

### @K-Mistele — 5 reactions  
`👍 5`  ·  [link](https://github.com/vllm-project/vllm/pull/5649#issuecomment-2270257579)

> HI maintainers - getting really close on this PR - would love some help resolving the dependency issue in the docs PR since that's been blocking CI but I haven't touched it and can't fix it. I think this is a really valuable PR and would really like to see it merged through, but I can't do it without your help
> 
> @WoosukKwon @simon-mo @mgoin @youkaichao @zhuohan123 @robertgshaw2-neuralmagic


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
