# 2dust/v2rayN #8352 — perf: Shadowsocks

**[View PR on GitHub](https://github.com/2dust/v2rayN/pull/8352)**

| | |
|---|---|
| **Author** | @DHR60 |
| **Status** | ✅ merged |
| **Opened** | 2025-11-19 |
| **Repo importance** | ★107,989 · 15,228 forks · score 173,899 |
| **Diff** | +231 / −63 across 2 files |
| **Engagement** | 16 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @DHR60 — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3611095222)

> > > 产物过大相关 issue 还是 open 状态
> > 
> > @DHR60 能否尝试使用 `--no-self-contained` 参数
> 
> 没问题的，和 `-p:SelfContained=false` 产物大小差不多

### @dyhkwong — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3625287445)

> v2ray/xray 的 ss+ws 传输层（无论启用 mux 与否），与 mux 不为零的 v2ray plugin websocket 模式，是两个不同的协议。
> https://github.com/v2ray/discussion/issues/173#issue-416470387

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3556053550)

> `"rollForward": "disable"`并且锁定 sdk 版本也感觉不太妥当
> 
> 目前直接将 `--self-contained false` 改为 `-p:SelfContained=false` 就行

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3556054606)

> 测试了是 PublishSingleFile 会影响 --self-contained

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3556097082)

> > `"rollForward": "disable"`并且锁定 sdk 版本也感觉不太妥当
> > 
> > 目前直接将 `--self-contained false` 改为 `-p:SelfContained=false` 就行
> 
> 因为没有什么时间查，只是简单的修改了下。看上次的 issue 不是说微软已经解决了吗？所以等微软解决了就把加的文件直接删除了就行

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8352#issuecomment-3556101789)

> > 只是按标准实现，何来"创造"一说？
> 
> 不是说你 pr 创造的。而是 ss 自己的实现创造的一个怪物


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
