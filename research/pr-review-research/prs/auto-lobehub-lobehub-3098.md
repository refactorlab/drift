# lobehub/lobehub #3098 — ✨ feat: Add Spark model provider

**[View PR on GitHub](https://github.com/lobehub/lobehub/pull/3098)**

| | |
|---|---|
| **Author** | @hezhijie0327 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-01 |
| **Repo importance** | ★78,228 · 15,371 forks · score 144,710 |
| **Diff** | +368 / −1 across 14 files |
| **Engagement** | 71 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @hezhijie0327 — 1 reactions  
`👍 1`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2202170543)

> 1. `tokens`参数即最大上下文长度官网没数据，找讯飞技术确认了下为 `8K` [已更新]
> ![image](https://github.com/lobehub/lobe-chat/assets/58100052/a8559119-4c7c-42e9-80e4-3efc1251dbb4)
> 2. `general` 和 `generalv2` 他们还在排查中（但是说实话他们的技术支持回复稍微有点一言难尽）

### @hezhijie0327 — 1 reactions  
`👍 1`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2210666672)

> `Lite` 模型的问题搞定了
> ![image](https://github.com/lobehub/lobe-chat/assets/58100052/019445ca-d8ea-4891-8759-713de48fd16a)
> 
> 和科大工程师确认了下 Spark 全系暂不支持 `user` 参数，其余模型可用也只是预留参数，并无实际用途
> ![image](https://github.com/lobehub/lobe-chat/assets/58100052/2fb7b861-d8f2-4216-b932-529fd2a42ebf)
>  
> Solution: 引入了一个 `noUserId` 的 boolean 变量，用于控制是否在 POST 中添加 `user`，默认保持现有逻辑进行添加，当为 `true` 时，忽略 `user`

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2199106187)

> 配置页面是不是应该改成 APIKey 和 APISecret 分开配置比较合适？不然用户很有可能会配错

### @hezhijie0327 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2199471141)

> 逻辑都通了，自动将 APIKey 与 API Secret 合并成完整 API  
> 
> 但是遇到个问题，这个文言显示搞不明白
> ![image](https://github.com/lobehub/lobe-chat/assets/58100052/10436021-7188-478b-87ec-0cdfb18a5322)

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2199507431)

> 是 locale 吗？ 参考这里补充 i18n:
> 
> https://github.com/lobehub/lobe-chat/blob/main/src/locales/default/modelProvider.ts#L22-L48

### @hezhijie0327 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3098#issuecomment-2199558540)

> > 是 locale 吗？ 参考这里补充 i18n:
> > 
> > https://github.com/lobehub/lobe-chat/blob/main/src/locales/default/modelProvider.ts#L22-L48
> 
> 放进去了 但是貌似没调用 不清楚哪里写错了


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
