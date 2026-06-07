# lobehub/lobehub #3855 — 📝 docs: update local docker-compose auth to casdoor

**[View PR on GitHub](https://github.com/lobehub/lobehub/pull/3855)**

| | |
|---|---|
| **Author** | @cy948 |
| **Status** | ✅ merged |
| **Opened** | 2024-09-09 |
| **Repo importance** | ★78,228 · 15,371 forks · score 144,710 |
| **Diff** | +467 / −51 across 11 files |
| **Engagement** | 67 conversation · 7 inline review comments |

## Top review comments (ranked by reactions)

### @cy948 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2339372172)

> > 这个方案是本地体验还是生产也可以用？
> 
> @arvinxx 推荐本地体验，用于生产则需要更改密钥。但改密钥又会回到像logto那样复杂的配置过程，还是作为本地体验版本好点？

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2342514855)

> @cy948 那就直接替换本地那个 logto 的文件夹吧。或者 logto 的改个别的名字，local-logto

### @zhuozhiyongde — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2351497186)

> ~~睡了 20 个小时，来干活了！~~
> 
> 1. 下载下来的 .env 没有根据语言参数切换
> 2. 应该是 docker compose up -d
> 3. 首先打开的应该是 8000 端口，而不是 lobe 的 3210

### @zhuozhiyongde — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2351504716)

> docker compose up -d 现在也启动不起来，lobe 报错 Error: [NextAuth] provider generic-oidc is not supported
> 
> 是由于相关 PR 没有合并触发 docker 的相应构建吗

### @cy948 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2351507295)

> @zhuozhiyongde 你看看是不是本地的 lobechat-database 镜像没有更新？

### @zhuozhiyongde — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/3855#issuecomment-2351507774)

> > @zhuozhiyongde 你看看是不是本地的 lobechat-database 镜像没有更新？
> 
> 我去，睡傻了


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
