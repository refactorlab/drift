# clash-verge-rev/clash-verge-rev #6052 — feat(tunnels): add tunnels viewer UI with add/delete support

**[View PR on GitHub](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052)**

| | |
|---|---|
| **Author** | @aoxiangtianyu-go |
| **Status** | ✅ merged |
| **Opened** | 2026-01-09 |
| **Repo importance** | ★123,321 · 8,979 forks · score 164,226 |
| **Diff** | +1051 / −18 across 24 files |
| **Engagement** | 20 conversation · 19 inline review comments |

## Top review comments (ranked by reactions)

### @Slinetrac — 1 reactions  
`👀 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3731539633)

> 1. 本地地址改成本地监听地址，本地端口改成本地监听端口。
> 2. **[proxy 是可选项](https://wiki.metacubex.one/config/tunnels/#proxy)。**

### @Slinetrac — 1 reactions  
`👀 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3733843041)

> 既然本地监听端口是独立的，那么我们顺便复用现有的（https://github.com/clash-verge-rev/clash-verge-rev/commit/16c3dcc616065ed0d0bac7ae0bb87dac625dfbb6 实现的）端口占用检测也是自然的。

### @Slinetrac — 1 reactions  
`👀 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3737908878)

> > 当前的CIDR匹配正则无法很好地适应 host:port 格式，它主要是针对IP地址和子网掩码的匹配。
> 
> 坏了，早上没睡醒没仔细看，抱歉 :/
> 
> > 对于目标地址，是否需要同时支持对 domain:port 格式的检验？或者将目标地址和目标地址端口拆成两个输入框以减小校验难度？
> 
> 建议拆开，与本地监听结构上一致。

### @oomeow — 1 reactions  
`👀 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3763100563)

> > 但在切换订阅 / 生成运行时配置时自动清理无效 `proxy` 值
> 
> 我觉得这样确实可行  @aoxiangtianyu-go

### @aoxiangtianyu-go — 0 reactions  
`—`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3733282289)

> 已修改，感谢 review，现在表现如下：
> <img width="2554" height="1530" alt="屏幕截图 2026-01-11 005857" src="https://github.com/user-attachments/assets/0a8b9b9d-2894-460a-9f09-e07845eb953e" />

### @aoxiangtianyu-go — 0 reactions  
`—`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6052#issuecomment-3736479329)

> 感谢review，现在表现如下:
> ~已配置的隧道是代码修改前添加的~
> <img width="2554" height="1529" alt="image" src="https://github.com/user-attachments/assets/e4c46942-078f-4cb8-aa8a-29577c446ded" />
> 
> ---
> 
> 当前的 IP 校验正则较难维护，我在想是否可以引入第三方库来提高可维护性。如果觉得继续使用正则更合适的话，我明天会加上相应的测试用例。


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
