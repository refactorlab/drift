# 2dust/v2rayN #7929 — Multi profile

**[View PR on GitHub](https://github.com/2dust/v2rayN/pull/7929)**

| | |
|---|---|
| **Author** | @DHR60 |
| **Status** | ✅ merged |
| **Opened** | 2025-09-11 |
| **Repo importance** | ★107,989 · 15,228 forks · score 173,899 |
| **Diff** | +2748 / −404 across 43 files |
| **Engagement** | 30 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3278626595)

> TODO:
> - [ ] 支持在 `链式代理` 中添加 `配置组`
> - [x] 支持在 `配置组` 中添加 `配置组`
> - [x] 支持在节点分流中填入 `配置组`
> - [x] `配置组` 添加 `故障转移` 模式

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3279464464)

> > * [ ]  支持在 `链式代理` 中添加 `配置组`
> 
> 这个就不做了，挺麻烦的
> 并且配置组对应的子配置生成时，依然遵循他自己的链式代理，~~因为是调用的现有的 GenOutboundsList，不知道算不算 well-behaved~~

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3279514859)

> 先做一个最简化的功能吧。
> 链式代理你也做了？这个不建议做，真不知道为什么有这样的需求？
> 近期不会合并，估计要到10月份才会有时间

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3279648553)

> ok
> 功能差不多都做完了，只剩测试和优化了
> 链式代理，能做就也写上了，多了一个 GenChainOutboundsList，不算太难维护

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3322431436)

> 有个小 bug，新加的 AddGroupServerWindow 调用打开 ProfilesSelectWindow，AddGroupServerWindow 标题栏是白的，别的现有的窗口都是黑的，没找到原因

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/7929#issuecomment-3322595801)

> > 有个小 bug，新加的 AddGroupServerWindow 调用打开 ProfilesSelectWindow，AddGroupServerWindow 标题栏是白的，别的现有的窗口都是黑的，没找到原因
> 
> 可能需要这个
> `WindowsUtils.SetDarkBorder(this, AppManager.Instance.Config.UiItem.CurrentTheme);`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
