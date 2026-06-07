# 2dust/v2rayN #8659 — Refactor profile item config

**[View PR on GitHub](https://github.com/2dust/v2rayN/pull/8659)**

| | |
|---|---|
| **Author** | @DHR60 |
| **Status** | ✅ merged |
| **Opened** | 2026-01-17 |
| **Repo importance** | ★107,989 · 15,228 forks · score 173,899 |
| **Diff** | +951 / −802 across 40 files |
| **Engagement** | 33 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3763248299)

> 感谢 PR。
> 这个 PR 感觉步子不够大啊。
> 参考 
> https://github.com/2dust/v2rayNG/blob/master/V2rayNG/app/src/main/java/com/v2ray/ang/dto/ProfileItem.kt
> 
> 只保留大概下面的属性，其他全部用json 字符串，基本上json 字符串中都是各个 outbound 的特有属性。
> ```
> val configVersion: Int = 4,
>     val configType: EConfigType,
>     var subscriptionId: String = "",
>     var addedTime: Long = System.currentTimeMillis(),
> 
>     var remarks: String = "",
>     var server: String? = null,
>     var serverPort: String? = null,
> 
>     var network: String? = null,
>   var host: String? = null,
>     var path: String? = null,
> 
>   var tlssecurity: String? = null,
>   var sni: String? = null,
>     var alpn: String? = null,
>     var fingerPrint: String? = null,
>     var insecure: Boolean? = null,
> ```
> 
> 迁移的时候给数据版本+1 即可，这个过程可能需要半年到一年的时间，然后可以删除迁移代码。

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3763257548)

> 原来的  ProfileItem  和 ProfileGroupItem 需要保留很长时间，方便迁移。
> 这个 PR 暂时不合并，等讨论清楚些再说

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3763276935)

> https://github.com/2dust/v2rayNG/blob/master/V2rayNG/app/src/main/java/com/v2ray/ang/dto/ProfileItem.kt
> 参考这个的原因，是想把原来一些属性共用存储的问题也处理下，增加可读性。

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3763453508)

> > 这个 PR 感觉步子不够大啊。 
> 
> 因为全部迁移到 json 我个人感觉没什么好处，反而增加了序列化反序列化的性能损耗
> 
> 这个是为了给个别协议添加他们独属字段，放到 ProfileItem sql table 里未免有点过于浪费空间了
> 
> > 把原来一些属性共用存储的问题也处理下，增加可读性。
> 
> 这个确实，~~密码有的用 id 有的用 security~~。我的想法是传输层的字段分开，放到 sql table 里；协议独属的放到 json 里

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3765105552)

> `因为全部迁移到 json 我个人感觉没什么好处，反而增加了序列化反序列化的性能损耗`
> 
> 确实不应该全部迁移，不过这不是序列化的性能问题，这个不值一提。 主要是开发麻烦了些。
> 
> 大概下面的留下
> 
> ```
> 
>   val configVersion: Int = 4,
>     val configType: EConfigType,
>     var subscriptionId: String = "",
>     var addedTime: Long = System.currentTimeMillis(),
> 
>     var remarks: String = "",
>     var server: String? = null,
>     var serverPort: String? = null,
> 
>   var password: String? = null,
>     var method: String? = null,  
>     var username: String? = null,
> 
>     var network: String? = null,
>     var headerType: String? = null,
>     var host: String? = null,
>     var path: String? = null,
>     var seed: String? = null,
>     var quicSecurity: String? = null,
>     var quicKey: String? = null,
>     var mode: String? = null,
>     var serviceName: String? = null,
>     var authority: String? = null,
>     var xhttpMode: String? = null,
>     var xhttpExtra: String? = null,
> 
>     var security: String? = null,
>     var sni: String? = null,
>     var alpn: String? = null,
>     var fingerPrint: String? = null,
>     var insecure: Boolean? = null,
>     var echConfigList: String? = null,
>     var echForceQuery: String? = null,
> 
>     var publicKey: String? = null,
>     var shortId: String? = null,
>     var spiderX: String? = null,
>     var mldsa65Verify: String? = null,
> ```
> 
> 其中这些也可以考虑放 json ，毕竟是会随着 network 变化
> ```
>     var seed: String? = null,
>     var quicSecurity: String? = null,
>     var quicKey: String? = null,
>     var mode: String? = null,
>     var serviceName: String? = null,
>     var authority: String? = null,
>     var xhttpMode: String? = null,
>     var xhttpExtra: String? = null,
> ```

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8659#issuecomment-3765108522)

> `这个确实，密码有的用 id 有的用 security。我的想法是传输层的字段分开，放到 sql table 里；协议独属的放到 json 里`
> 
> 还有一个考虑，大概以 Vless 协议能用的为准


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
