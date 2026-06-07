# microsoft/autogen #1405 — Code executors

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/1405)**

| | |
|---|---|
| **Author** | @ekzhu |
| **Status** | ✅ merged |
| **Opened** | 2024-01-25 |
| **Repo importance** | ★58,718 · 8,861 forks · score 98,459 |
| **Diff** | +1419 / −129 across 22 files |
| **Engagement** | 36 conversation · 75 inline review comments |

## Top review comments (ranked by reactions)

### @LeoLjl — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1911601412)

> This limitation 1 is exactly what I have been observing with weaker language models as backends. They tend to suggest python code that relies on variables defined on earlier codes and therefore gets an error. This error could take many turns for LM to fix and sometimes never fixed. This new feature could potentially release more power from smaller LMs. Really exciting work!

### @ekzhu — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1920077944)

> > Great PR!
> > 
> > It looks like `AssistantAgent` is not modified by this. As noted by @afourney above, "the default assistant prompt is heavily tuned to suggesting sh and python code, and heavily instructed to making sure the code blocks stand alone." In fact, the system prompt of `AssistantAgent` was always the main thing distinguishing it from `ConversableAgent`. So since this PR recommends adding a code executor directly to an instance of `ConversableAgent`, thereby appending instructions about code execution to its prompt, is there any reason to keep `AssistantAgent` around? Do you recommend deprecating it in the future?
> 
> @rickyloynd-microsoft I agree deprecating `AssistantAgent` is a good idea. We can do this in a future PR. Right now `AssistantAgent` is hard-wired with a default prompt that may not work well with non-openai models. Since the system prompt is being updated by the code executor, we should just use `ConversableAgent` in our examples instead. This would be in future PRs for updating the documentation. Since this the changes introduced in this PR does not affect how existing code is used, we can make the documentation related changes overtime.

### @ekzhu — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1911266702)

> @afourney H
> 
> > I like this idea very much.
> > 
> > Given that we use the markdown header to specify language, should be allow executor to be a dictionary?
> > 
> > ```
> > {
> >     "executor": {
> >         "python": notebook_executor,
> >         "sh": terminal_executor,
> >         "typescript": ts_executor,
> >         "c#": c_sharp_executor
> >    },
> >    ...
> > }
> > ```
> 
> Thanks. This is actually an interesting idea that the dictionary entry could be an instance of an executor to achieve customization. Though currently we assume the code executor is supposed to be language agnostic -- as the LLM could produce code in multiple languages and we assume those will be executed in the same environment. So, the code executor is more about the environment in which the code runs. E.g., a command line environment which supports command utilities, an ipython environment that only supports ipython commands (python code and stuff like `! pip install package`.) 
> 
> We can also introduce Google Code Lab environment and .NET interactive (shout out to @LittleLittleCloud @colombod) in the future. For now, I am expecting mostly community contributions on these cases. Each executor can put in their configuration parameters inside the `code_execution_config`:
> 
> ```python
> {"executor": "ipython",
>   "ipython": {
>     "timeout": 50,
>     "preload_modules": ["numpy", "pandas", ...],
>   }
> }
> ```

### @ekzhu — 1 reactions  
`😄 1`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1911287769)

> > Are you imagining that the executors might also contain suggested meta-prompts, or descriptions, that can make this a little more integrated?
> 
> You are thinking what I am thinking. I just updated the PR description.  In short:
> 
> ```python
> agent = ConversableAgent("agent", ...)
> user_proxy.code_executor.user_capability.add_to_agent(agent)
> ```

### @afourney — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1912305388)

> > This limitation 1 is exactly what I have been observing with weaker language models as backends. They tend to suggest python code that relies on variables defined on earlier codes and therefore gets an error. This error could take many turns for LM to fix and sometimes never fixed. This new feature could potentially release more power from smaller LMs. Really exciting work!
> 
> It's not just weaker models -- though they are less able to recover. I'm sitting on logs and logs and logs of GPT-4 making exactly this mistake when run on the GAIA benchmark dataset.

### @ekzhu — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/autogen/pull/1405#issuecomment-1915784285)

> @jackgerrits @gagb 
> 
> As per our discussion offline, let's review this PR with the idea that it is for a minimal feature set for replicating the existing code execution using two environments (command line and ipython). We will add more features like custom module loading in the future.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
