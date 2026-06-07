# farion1231/cc-switch #930 — feat(copilot): add GitHub Copilot reverse proxy support

**[View PR on GitHub](https://github.com/farion1231/cc-switch/pull/930)**

| | |
|---|---|
| **Author** | @Mason-mengze |
| **Status** | ✅ merged |
| **Opened** | 2026-02-05 |
| **Repo importance** | ★92,337 · 6,022 forks · score 121,418 |
| **Diff** | +4552 / −1059 across 50 files |
| **Engagement** | 21 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @yuhaowin — 8 reactions  
`👍 8`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-3894418112)

> This is a great feature, and I hope it will be available soon.

### @ivenxu — 4 reactions  
`👍 4`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-3950769130)

> > > 在这个PR中，不能考虑把这个接口做更通用一点。github copilot的接口本质上是一个OAuth2 + /v1/models通过模型元数据告知客户端有哪些模型可用。如果能把这个接口做更通用。如果能把这个接口做更通用，其他类似的模型都一个并支持非常好。
> > 
> > > 在这个PR中，不能考虑把这个接口做更通用一点。github copilot的接口本质上是一个OAuth2 + /v1/models通过模型元数据告知客户端有哪些模型可用。如果能把这个接口做更通用。如果能把这个接口做更通用，其他类似的模型都一个并支持非常好。
> > 
> > 不太明白，您的意思是：将所有平台都使用接口返回可用模型，让用户选择对应的模型，对吗？
> 
> v1/models是一个nice to have的功能，它可以直接提供信息给用户选而不用去github后台看哪些模型可用，但不是最重要的。我想表达的重点是OAuth2/OIDC这部分。有很多LLM服务除了API Key认证外，也大多开始支持OIDC了，比如LiteLLM, https://docs.litellm.ai/docs/oidc, Azure OpenAI的endpont也支持OIDC。
> 
> 最接近于github copilot的是kiro。我的想法是能不能把这个PR做成通用的OAuth2/OIDC这样可以用在copilot上也可以用在kiro上。需要允许用户填入一个认证的URL。

### @farion1231 — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-4053176384)

> 我准备修改一下，做一些方便拓展的设计，后续可以加上 codex oauth 之类的

### @farion1231 — 4 reactions  
`👍 4`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-4064587226)

> 这个功能写的差不多了，正在测试中
> 
> mrjeyeorg-eng ***@***.***> 于2026年3月16日周一 09:55写道：
> 
> > *mrjeyeorg-eng* left a comment (farion1231/cc-switch#930)
> > <https://github.com/farion1231/cc-switch/pull/930#issuecomment-4064560934>
> >
> > 请问什么时候可以使用github copilot添加呢？
> >
> > —
> > Reply to this email directly, view it on GitHub
> > <https://github.com/farion1231/cc-switch/pull/930#issuecomment-4064560934>,
> > or unsubscribe
> > <https://github.com/notifications/unsubscribe-auth/AKW3RFFA5CBB6S5VM4RJS234Q5NKBAVCNFSM6AAAAACUCRPC52VHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHM2DANRUGU3DAOJTGQ>
> > .
> > You are receiving this because your review was requested.Message ID:
> > ***@***.***>
> >

### @farion1231 — 1 reactions  
`👍 1`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-4072891454)

> > 这个pr是反代copilot，感觉有一定封号风险，不是很合规的样子，合并的话要慎重些
> 
> 我其实考虑过挺久这个问题，研究后发现很少有反代copilot被封号的先例（批量分发除外），codex也是，到时候也会加上风险提示

### @ivenxu — 0 reactions  
`—`  ·  [link](https://github.com/farion1231/cc-switch/pull/930#issuecomment-3944048815)

> 在这个PR中，能不能考虑把这个接口做得更通用一点。github copilot的接口本质上是一个OAuth2 + /v1/models通过模型元数据来告知客户端有哪些模型可用。如果能把这个通用接口做成，其它类似模式都一并支持是非常好的。


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
