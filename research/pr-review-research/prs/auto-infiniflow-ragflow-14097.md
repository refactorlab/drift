# infiniflow/ragflow #14097 — Feat: add OpenDataLoader PDF parser backend (#14058)

**[View PR on GitHub](https://github.com/infiniflow/ragflow/pull/14097)**

| | |
|---|---|
| **Author** | @wdeveloper16 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-14 |
| **Repo importance** | ★81,972 · 9,443 forks · score 124,743 |
| **Diff** | +1228 / −3 across 16 files |
| **Engagement** | 65 conversation · 45 inline review comments |

## Top review comments (ranked by reactions)

### @xugangqiang — 2 reactions  
`❤️ 1 · 🚀 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4264991738)

> @wdeveloper16 
> 
> Appreciate your contribution.
> 
> May I know if below has been conducted:
> 1. unit test
> 2. integration test
> 3. regression test
> 
> If all the tests mentioned above has been conducted, could you please upload the testing evidence?
> 
> Also, consider this is relatively a big change, please expect some delay in review.
> 
> Thanks.

### @xugangqiang — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4293851571)

> @wdeveloper16 
> I can see the second video now. It proves that the result could be accepted by ragflow.
> 
> Could you please test the parsed result in "Chat" tab?
> 1. Navigate to "Chat" tab
> 2. Click "Create chat" and associate the chat with the dataset you created (which used open data loader to parse)
> 3. Ask questions (related to the document) to the chat and check the answer to see if it's realted
> 4. Upload the testing evidence
> 
> Thank you.

### @xugangqiang — 1 reactions  
`👍 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4285660727)

> There should be a standalone Open Data Loader service 
> -> This means, the "Open Data Loader service" should exist, and it should not be part of Ragflow. It could be in a separate docker in your local ENV, or in a remote server.

### @xugangqiang — 1 reactions  
`👍 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4301228792)

> @wdeveloper16 
> Thank you for your contribution. 
> Reviewed the py file with some comments.

### @yingfeng — 1 reactions  
`👍 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4301564076)

> Using environment variables to set API endpoint is non-trival to users and is not flexible enough. 
> Currently, MinerU, Dockling, PaddleOCR-VL, all can be configured through web ui in the model provider section.  Remove the environment variables from docker/.env and add the configuration into model provider with OCR label, thank you

### @yingfeng — 1 reactions  
`👍 1`  ·  [link](https://github.com/infiniflow/ragflow/pull/14097#issuecomment-4305763200)

> I meant to remove content from documentation because those environment variable settings are not used any more.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
