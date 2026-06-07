# 2dust/v2rayNG #2889 — More fragment options + Fix for reality configs

**[View PR on GitHub](https://github.com/2dust/v2rayNG/pull/2889)**

| | |
|---|---|
| **Author** | @vfarid |
| **Status** | ✅ merged |
| **Opened** | 2024-03-02 |
| **Repo importance** | ★57,543 · 7,532 forks · score 92,650 |
| **Diff** | +16 / −2 across 2 files |
| **Engagement** | 34 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @a-pav — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1980259551)

> > Unfortunately the right way is to set fragment for each config seperately, but @2dust declined my pr in this regard to keep UI simple for most users who dont need fragment at all. I hope he reconsider his decision...
> 
> Perhaps `Enable Global Fragment` and `Enable per-config Fragment` (both disabled by default) could be toggles inside the application's settings? This helps with keeping the UI clean for those who don't need fragment at all, and bring it on in cases that it is needed. I imagine this could potentially complicate things under the hood a little bit. But since you already have implemented both the per-config and the global flow, it shouldn't be hard to make them work and coexist together inside the program.
> 
> In either way, I still like to have the global fragment settings around, since for me the need for fragment is mostly a network matter, and not necessary a server specific matter.

### @farzadasg61 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1974850241)

> Please add the code. We need this code in Iran, and many thanks to Mr. Vahid.

### @vfarid — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1974872799)

> > @vfarid Could you also fix Early Data? Check This : #2887 [XTLS/Xray-core#375](https://github.com/XTLS/Xray-core/pull/375)
> 
> I tested early data in path in both import and export of custom config and its just fine. May be there is some issue in your config, dont know. Yo may provide issue details in related thread.

### @2dust — 2 reactions  
`👍 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1975057914)

> Has the test passed?
> Because we cannot get correct test results at our location

### @vfarid — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1975068653)

> > Has the test passed? Because we cannot get correct test results at our location
> 
> Yes, ive tested it with several configs. When we fragment tlshello on reality configs, they will stop working in more than 90% of configs because sni is fake in reality. Instead we can fragment starting packets as described in xtls docs.

### @vfarid — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2889#issuecomment-1978634650)

> > > since tlshello will destroy reality configs
> > 
> > Xray-core v1.8.4 以后 REALITY 服务端支持 tlshello 形式的分片，请测试一下（但还取决于 `dest` 是否支持它）
> 
> They said "need to be tested" and i tested with several reality configs, most of them will stop working as soon as fragment is activated for tlshello, but they will work if we fragment packets 1-n instrad of packet 0.
> This is also match with concept of reality sni because the sni in reality is not pointing the server and is fake.
> 
> I am still testing and waiting to get test result from my twitter followers in order to findout if my conclusion is not 100% correct. So if you have any test result that shows tlshello fragment will correct curropted reality config and make it work, please share with me.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
