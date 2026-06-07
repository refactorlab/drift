# ChatGPTNextWeb/NextChat #4930 — support azure deployment name

**[View PR on GitHub](https://github.com/ChatGPTNextWeb/NextChat/pull/4930)**

| | |
|---|---|
| **Author** | @lloydzhou |
| **Status** | ✅ merged |
| **Opened** | 2024-07-05 |
| **Repo importance** | ★88,181 · 59,647 forks · score 331,475 |
| **Diff** | +204 / −95 across 17 files |
| **Engagement** | 37 conversation · 18 inline review comments |

## Top review comments (ranked by reactions)

### @itcodes — 2 reactions  
`👍 2`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2212496171)

> > #3344 @Dogtiti 我怀疑我的部署就是因为这条 pr出现了问题。我的部署名是 gpt-4o。构建版本自动更新后，遇到一个问题。如果https://****.openai.azure.com/openai/deployments/gpt-4o/愣是出现了 2 个版本的 gpt4o。我的配置只有gpt4o
> ![CleanShot 2024-07-08 at 00 05 34@2x](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/assets/8282645/811417ab-8bf1-4742-83c6-7f5ccec19a2b)
> 
> ![CleanShot 2024-07-08 at 00 04 41@2x](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/assets/8282645/20d772ac-7798-4a5b-8dab-294d1ecb7e94)

### @lloydzhou — 1 reactions  
`👀 1`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2213379528)

> > Hi @Dogtiti @lloydzhou 我遇到了和 @itcodes 相同的问题。我在[#4934 (comment)](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/pull/4934#issuecomment-2213337702) 提及了。
> > 
> > 具体来说，这次改动在环境变量明确给定了gpt-4o的情况下，会出现下图中的两个选项，而默认情况下它会选择openai。手动改成azure才能解决问题。
> > 
> > 我认为这不符合直觉，特别是在环境变量明确给定了AZURE_URL的情况下。或者说能否提供下providerName and displayName的相关文档，这样可以显式地在CUSTOM_MODELS里配置gpt-4o为`gpt-4o(Azure)=gpt-4o`
> > 
> > ![](https://private-user-images.githubusercontent.com/8282645/346348161-20d772ac-7798-4a5b-8dab-294d1ecb7e94.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjA0MjU1NjcsIm5iZiI6MTcyMDQyNTI2NywicGF0aCI6Ii84MjgyNjQ1LzM0NjM0ODE2MS0yMGQ3NzJhYy03Nzk4LTRhNWItOGRhYi0yOTRkMWVjYjdlOTQucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI0MDcwOCUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNDA3MDhUMDc1NDI3WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9MWNjY2I0NTVmYzQ0NGI2ZDQyOGM4Y2FhZmU5NmI2Nzk2OTdmZmRlNzY3OGE2MmQ4ODQ4OWY4ZTRiMjdjMmIxYiZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.zSmnkGdI_xGsRdsdIeb3FMZsp4yeGWcXUUZcRPwuSws)
> 
> # 两个问题
> 1. 配置customModels的情况下，同时出现openai和azure，确实不合理，这个需要解决（不过这个只是展示问题，并不影响请求处理失败的逻辑）
> > 但是之前解决的时候遇到问题，因为AZURE_URL是在server config这边进行的配置，这个配置并不会被发送到前端，所以前端页面不太好判断
> > 另外就是代码需要考虑仅在app端运行的情况，app内运行的时候并没有node server也无法通过env文件中的配置进行处理
> > 所以，后面会考虑一下如何在不同的环境都能准确的判断，并且合理的展示
> 
> 2. 需要检查一下，在什么配置下会出现azure的请求错误发送到`/api/openai`以及出现deployment not found的错误信息！这个是当前优先级最高的问题。

### @CoreJa — 1 reactions  
`👍 1`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2213474265)

> 理解。
> 
> 我同意你的看法，我考虑的做法是用CUSTOM_MODELS做文章，具体的，你可以新增一个parser，目前的语法是`model_name=display_name`，那么考虑`model_name<provider_name>=display_name`这样的格式去解析这个环境变量。
> 
> 此外`<>`内可以以键值对的形式扩展其它参数，例如`model_name<provider_name,max_tokens=xxx,param1=value1,...>=display_name`这样的形式（参考隔壁的lobechat）
> 
> 我理解这个做法对目前的侵入性是比较低的，可以考虑一下。

### @lloydzhou — 1 reactions  
`👍 1`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2213521448)

> 其实中间和另一个开发者讨论过使用 `model_name@provider=display_name`，然后`display_name`可以作为`deployment_name`（`azure`和`豆包`都需要使用`deployment_name`）
> 
> 关于你提到的`<key=value,...>`的语法，这里既然在`<>`中间使用看kv的模式命令，那么最后的这个等于是不是就没存在的必要了，只需要放到括号中间即可

### @CoreJa — 1 reactions  
`👍 1`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2213569413)

> 我没理解“最后的这个等于没有存在的必要”这句话。是指不需要`display_name`吗？
> 
> `display_name`我觉得还是可以存在的，没必要干掉。我没有找到“必须不能删”的理由，但一个不太寻常的case是，我在同一个azure账户上deploy了多个gpt-3.5-turbo的model，以供不同用户组使用。但我希望他们在NextChat上显示的都是相同的名字gpt-3.5-turbo。
> 
> 或者是我在本地部署的ollama或者其他openai api兼容的provider，`model_name`应该是一个identity，但也许它太丑了/太长了，例如Qwen2-57B-A14B-Instruct-q4_K_M，我希望`display_name`可以是简单的qwen2-57B。
> 
> 或者说考虑向上兼容的问题，正在使用的许多用户可能已经指定了`display_name`，而且就是按照目前的`model_name=display_name`的格式，干掉它会带来不必要的不兼容问题，造成较大的侵入性。

### @CoreJa — 1 reactions  
`👍 1`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/4930#issuecomment-2213738649)

> 注意到 https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/pull/4930#issuecomment-2213569413 这里最后一点提及的
> 
> > 或者说考虑向上兼容的问题，正在使用的许多用户可能已经指定了display_name，而且就是按照目前的model_name=display_name的格式，干掉它会带来不必要的不兼容问题，造成较大的侵入性。
> 
> 绝大部分用户是希望或者默认普通的升级是无感知的，或者至少不会带来兼容性问题（例如python2 -> python 3)的灾难。当然不向前兼容也可以提前几个大版本标记这个写法`deprecated`也不失是一种方法，只是我认为这个改动不应造成这个程度的侵入性。


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
