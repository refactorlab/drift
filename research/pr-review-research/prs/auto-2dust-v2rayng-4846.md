# 2dust/v2rayNG #4846 — IPv6 Unreachability Fallback for TLS Configs

**[View PR on GitHub](https://github.com/2dust/v2rayNG/pull/4846)**

| | |
|---|---|
| **Author** | @hossinasaadi |
| **Status** | ✅ merged |
| **Opened** | 2025-08-14 |
| **Repo importance** | ★57,543 · 7,532 forks · score 92,650 |
| **Diff** | +18 / −3 across 2 files |
| **Engagement** | 18 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @hossinasaadi — 2 reactions  
`🎉 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3193439971)

> > I have never used happyEyeballs. What advantages does it have in a real environment?
> 
> https://github.com/XTLS/Xray-core/pull/4667
> 
> for example suppose our IP-list is [ip4-1, ip4-2, ip4-3, ip4-4, ip6-1, ip6-2, ip6-3, ip6-4]
> 
> when interleave  is 1 and prioritizeIPv6 is false, the sorted-ip-list is:
> [ip4-1, ip6-1, ip4-2, ip6-2, ip4-3, ip6-3, ip4-4, ip6-4]
> 
> and when for example interleave is 2 and prioritizeIPv6  is true:
> [ip6-1, ip6-2, ip4-1, ip4-2, ip6-3, ip6-4, ip4-3, ip4-4]
> 
> then delay 250ms for each attempt until first connection is established.
> 
> the first-stablished-connection is winner connection and selected for sending/receiving data.

### @patterniha — 1 reactions  
`😄 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3189037549)

> > emm, I mean the bug when resolvedIps.isNullOrEmpty() == true
> > 
> > or
> > 
> > ```kotlin
> >             if (newHosts.containsKey(domain)) {
> >                 item.ensureSockopt().domainStrategy = "UseIP"
> >                 item.ensureSockopt().happyEyeballs = StreamSettingsBean.happyEyeballsBean(
> >                     prioritizeIPv6 = preferIpv6,
> >                     interleave = 2
> >                 )
> >                 continue
> >             }
> > 
> >             val resolvedIps = HttpUtil.resolveHostToIP(domain, preferIpv6)
> >             if (resolvedIps.isNullOrEmpty()) continue
> > 
> >             item.ensureSockopt().domainStrategy = "UseIP"
> >             item.ensureSockopt().happyEyeballs = StreamSettingsBean.happyEyeballsBean(
> >                 prioritizeIPv6 = preferIpv6,
> >                 interleave = 2
> >             )
> > ```
> > 
> > or
> > 
> > ```kotlin
> > if (resolvedIps.isNullOrEmpty()) {
> >     item.ensureSockopt().domainStrategy = null
> >     continue
> > }
> > ```
> > 
> > Failure to handle this will result in a DNS loop.
> 
> ?
> both of these codes are correct, I said the same thing.

### @patterniha — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3193447057)

> when we have multiple-IP, this causes a race between ips and it tries to find to the first IP that can be connected.
> 
> so it solve ipv4/ipv6 unreachable problem.
> 
> I wrote a full explanation when I implemented it on the core: https://github.com/XTLS/Xray-core/pull/4667
> 
> ///
> 
> also, it only applies when sockopt-domainStrategy is UseIP/ForceIP, and for AsIs mode golang-happy-eyeballs is applied.
> 
> you can read Xray-core doc for it : https://xtls.github.io/config/transport.html#sockoptobject
> 
> ///
> 
> Anyway, this PR has used this feature correctly.

### @hossinasaadi — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3188157269)

> Maybe we should only do Happy Eyeballs when IPv6 is preferred?

### @patterniha — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3188646903)

> in v2rayNG, and for proxy-outbound, happy eyeballs only operates when Outbound domain pre-solve method is `Resolve and add to DNS Hosts`.
> 
> `domainStrategy` should always be `UseIP` regardless of `Prefer IPv6`.
> 
> if `Prefer IPv6` is `true`, set `prioritizeIPv6` to `true`, otherwise `false`.
> 
> set `tryDelayMs` to `250` and let `interleave` and `maxConcurrentTry` be the default values( `1` and `4`)

### @hossinasaadi — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayNG/pull/4846#issuecomment-3188730780)

> > in v2rayNG, and for proxy-outbound, happy eyeballs only operates when Outbound domain pre-solve method is `Resolve and add to DNS Hosts`.
> > 
> > `domainStrategy` should always be `UseIP` regardless of `Prefer IPv6`.
> > 
> > if `Prefer IPv6` is `true`, set `prioritizeIPv6` to `true`, otherwise `false`.
> > 
> > set `tryDelayMs` to `250` and let `interleave` and `maxConcurrentTry` be the default values( `1` and `4`)
> 
> Thank you. I implemented `prioritizeIPv6` so that when `prefer IPv6` is enabled, it’s set to true and the `interleave` is set to 2, which makes it check two IPs of the selected version first (either IPv4 or IPv6).
> As far as I’ve checked, this config seems to work properly.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
