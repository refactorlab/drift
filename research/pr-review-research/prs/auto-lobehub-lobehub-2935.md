# lobehub/lobehub #2935 — ✨ feat: Add NextAuth as authentication service in server database

**[View PR on GitHub](https://github.com/lobehub/lobehub/pull/2935)**

| | |
|---|---|
| **Author** | @cy948 |
| **Status** | ✅ merged |
| **Opened** | 2024-06-19 |
| **Repo importance** | ★78,228 · 15,371 forks · score 144,710 |
| **Diff** | +3495 / −123 across 40 files |
| **Engagement** | 48 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @cy948 — 4 reactions  
`👍 3 · 🎉 1`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2228053300)

> @arvinxx rebase完了，还在 `src/config/auth.ts` 加了些提示方便用户迁移环境变量。

### @dogeggo — 1 reactions  
`😄 1`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2266685092)

> > @534002646 docker有两个镜像，有一个是server版本，遇到问题的是哪个？
> 
> 没有问题了，重新拉了数据库版本的，感谢🙏

### @cy948 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2232553117)

> > 其他我没啥问题了，就是要一个配置流程的文档，我跟着走一遍看看行不行
> 
> OK，可以先在PR讨论区里补一个简单的配置文档吗？

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2232574167)

> > > 其他我没啥问题了，就是要一个配置流程的文档，我跟着走一遍看看行不行
> > 
> > OK，可以先在PR讨论区里补一个简单的配置文档吗？
> 
> 可以的

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2241996440)

> 进到首页会抛错
> 
> <img width="1867" alt="image" src="https://github.com/user-attachments/assets/08f9cfee-0d71-4ea4-a0a8-86c172aaeae9">

### @arvinxx — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/2935#issuecomment-2242003157)

> 点击 signin Auth0 ，也仍然抛错：
> 
> <img width="1308" alt="image" src="https://github.com/user-attachments/assets/d055443c-bf36-49ef-8a11-4cfa4eac4c62">
> 
> 环境变量：
> 
> ```env
> 
> NEXT_AUTH_SECRET=212b5de1a85c2bdb9cb461d8fac03a50
> NEXT_AUTH_SSO_PROVIDERS=auth0
> ACCESS_CODE=abc213ej2rl23
> 
> # Auth0 configurations
> AUTH0_CLIENT_ID=xxx
> AUTH0_CLIENT_SECRET=cSX_xxx
> AUTH0_ISSUER=http://localhost:3010
> 
> NEXT_PUBLIC_SERVICE_MODE=server
> KEY_VAULTS_SECRET=
> DATABASE_DRIVER=node
> DATABASE_URL="postgresql://xxx:xxx@sha1.clusters.zeabur.com:30158/zeabur"
> ```
> 
> 服务端错误日志：
> 
> ```
> [auth][error] OperationProcessingError: "response" is not a conform Authorization Server Metadata response
>     at Module.processDiscoveryResponse (webpack-internal:///(rsc)/./node_modules/.pnpm/oauth4webapi@2.11.1/node_modules/oauth4webapi/build/index.js:289:15)
>     at getAuthorizationUrl (webpack-internal:///(rsc)/./node_modules/.pnpm/@auth+core@0.28.0/node_modules/@auth/core/lib/actions/signin/authorization-url.js:25:68)
> 
>  POST /api/auth/signin/auth0 302 in 409ms
> 
> digest: "284795093"
> [NextAuth] Error: {
>   cause: 'Configuration',
>   message: 'Wrong configuration, make sure you have the correct environment variables set. Visit https://lobehub.com/docs/self-hosting/advanced/authentication for more details.',
>   name: 'NextAuth Error'
> }
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
