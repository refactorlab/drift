# microsoft/autogen #2892 — Mistral Client

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/2892)**

| | |
|---|---|
| **Author** | @marklysze |
| **Status** | ✅ merged |
| **Opened** | 2024-06-08 |
| **Repo importance** | ★58,718 · 8,861 forks · score 98,459 |
| **Diff** | +873 / −267 across 11 files |
| **Engagement** | 24 conversation · 56 inline review comments |

## Top review comments (ranked by reactions)

### @Hk669 — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2156405019)

> > > i think, instead of adding mistral into the autogen dependencies, let the user have it installed manually if working with non-openai models as mentioned in the https://microsoft.github.io/autogen/docs/topics/non-openai-models/about-using-nonopenai-models/
> > > 
> > > cc @ekzhu
> > 
> > Hey @Hk669, yes, you make a good point - my intention is to do that and have users choose it in the same way as the GeminiClient, whereby it will install Mistral's API library if you specify it:
> > `pip install pyautogen[mistral]`
> > 
> > [So similar to what is shown here](https://microsoft.github.io/autogen/docs/topics/non-openai-models/cloud-gemini#installation).
> > 
> > If I've not done that correctly, can you let me know.
> 
> Yes @marklysze it was correctly setup, sorry i haven't gone through the complete code, assuming to add the dependencies. This PR looks good to me. Thanks for the PR. 
> 
> Also as mentioned, it would be great to add a notebook to help devs using mistralai with autogen. Thanks.

### @Hk669 — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2159694880)

> Yeah it seems to be an issue, let me raise a new PR to fix it.

### @qingyun-wu — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2168460764)

> > I have a question on the `_num_token_from_messages` function in `token_count_utils.py`.
> > 
> > [Function here](https://github.com/microsoft/autogen/blob/c221eea14e0acba569066718bbfeba75fa80aa54/autogen/token_count_utils.py#L87)
> > 
> > How critical is this function for these non-OpenAI client classes? Using the model name here won't always work because the same model could be run from different providers (e.g. Mistral.AI and Together.AI both support 'Mistral' and 'Mixtral' models). Also, Together.AI has a large array of models that can be run.
> > 
> > If we don't handle it, it raises a `NotImplementedError` exception.
> > 
> > So, any suggestions on how to handle this having only the model name? Should we default anything not catered for to gpt-4-0613 as per Gemini?
> > 
> > ```
> >     elif "gemini" in model:
> >         logger.info("Gemini is not supported in tiktoken. Returning num tokens assuming gpt-4-0613.")
> >         return _num_token_from_messages(messages, model="gpt-4-0613")
> > ```
> 
> Hi @marklysze, yes, to make things move faster, I think we can default anything not catered for to gpt-4-0613 as per Gemini, and include a warning message about it (and encourage people to make a contribution to add it if they need it and know how to calculate it).

### @marklysze — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2156390580)

> > i think, instead of adding mistral into the autogen dependencies, let the user have it installed manually if working with non-openai models as mentioned in the https://microsoft.github.io/autogen/docs/topics/non-openai-models/about-using-nonopenai-models/
> > 
> > cc @ekzhu
> 
> Hey @Hk669, yes, you make a good point - my intention is to do that and have users choose it in the same way as the GeminiClient, whereby it will install Mistral's API library if you specify it:
> `pip install pyautogen[mistral]`
> 
> [So similar to what is shown here](https://microsoft.github.io/autogen/docs/topics/non-openai-models/cloud-gemini#installation).
> 
> If I've not done that correctly, can you let me know.

### @marklysze — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2156390900)

> > would be nice to make a toy notebook or app in examples and a short blog post about it , to accompany the next release : this is cool ! & thanks for the contribution !
> 
> Hey @Josephrp, yep, absolutely - I'm going to work on that now as part of this PR :)

### @marklysze — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/autogen/pull/2892#issuecomment-2156446129)

> > Yes @marklysze it was correctly setup, sorry i haven't gone through the complete code, assuming to add the dependencies. This PR looks good to me. Thanks for the PR. 
> > 
> > Also as mentioned, it would be great to add a notebook to help devs using mistralai with autogen. Thanks. 
> 
> No problem, yes I'm writing that now and have found that I need to change the client class a bit around initialisation, so hold off any testing until I have a notebook included :)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
