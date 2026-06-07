# 2dust/v2rayN #9063 — Add xray tun support

**[View PR on GitHub](https://github.com/2dust/v2rayN/pull/9063)**

| | |
|---|---|
| **Author** | @DHR60 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-09 |
| **Repo importance** | ★107,989 · 15,228 forks · score 173,899 |
| **Diff** | +208 / −284 across 17 files |
| **Engagement** | 29 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @RPRX — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4256466434)

> sing-tun->ss->xray 的话需要加个参数 https://github.com/XTLS/Xray-docs-next/commit/44dda974c1a3c4d29dc814accbfc6ae3c43dbd62

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4241511616)

> 看了下只支持 windows 的 auto-route，仍需要为其他系统保留 TunProtectSocksPort 等，使用 sing-box 提供 tun 入站；仅为 windows 启用 xray tun
> 
> 然后我这边测试 `autoOutboundsInterface` 似乎仍会导致部分流量回环，CPU 占用 100%，需要在 outbound 里指定 `sockopt.Interface`；
> 可能是 xray 的 bug，这边如果要做的话应该要用 NetworkInterface 和 Socket.Connect 获取一下默认网络接口，网口变动用户可能需要手动重启 tun

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4241522936)

> > 看了下只支持 windows 的 auto-route，仍需要为其他系统保留 TunProtectSocksPort 等，使用 sing-box 提供 tun 入站；仅为 windows 启用 xray tun
> 
> 或者这边做个 ip route add 脚本，core 启动完成后 sudo 调用一下

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4242896634)

> > > 看了下只支持 windows 的 auto-route，仍需要为其他系统保留 TunProtectSocksPort 等，使用 sing-box 提供 tun 入站；仅为 windows 启用 xray tun
> > 
> > 或者这边做个 ip route add 脚本，core 启动完成后 sudo 调用一下
> 
> 如果通用性，是否脚本更好？ 各个系统都能用？

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4243103508)

> > 如果通用性，是否脚本更好？ 各个系统都能用？
> 
> 三个系统三个脚本吧，如果考虑清理路由表就是六个脚本
> 
> <details>
> 
> <summary>问了下 AI 差不多就这样：</summary>
> 
> ```
> 1. Windows (CMD/Batch)
> 保存为 setup_tun.bat。必须右键以管理员身份运行。
> 该脚本会自动检测 TUN 名称对应的 Interface Index (if)，因为 route 命令在处理所有请求导入时，指定索引是最稳健的。
> 
> @echo off
> setlocal enabledelayedexpansion
> 
> set TUN_NAME=%1
> if "%TUN_NAME%"=="" (
>     echo Usage: setup_tun.bat ^<TunName^>
>     exit /b 1
> )
> 
> echo Searching for Interface Index for: %TUN_NAME%...
> 
> :: 获取接口索引
> set "IF_INDEX="
> for /f "tokens=1" %%i in ('netsh interface ipv4 show interface ^| findstr /C:"%TUN_NAME%"') do (
>     set IF_INDEX=%%i
> )
> 
> if "%IF_INDEX%"=="" (
>     echo Error: Could not find interface with name %TUN_NAME%
>     exit /b 1
> )
> 
> echo Found Interface Index: %IF_INDEX%
> 
> :: 添加两条半段路由覆盖全局流量
> :: 0.0.0.0/1 -> 0.0.0.0 mask 128.0.0.0
> :: 128.0.0.0/1 -> 128.0.0.0 mask 128.0.0.0
> :: 注意：Windows 的 route add 必须指向一个存在的网关，通常 TUN 自身地址即可
> :: 这里使用 'if' 参数强制指定物理接口路径
> 
> route add 0.0.0.0 mask 128.0.0.0 0.0.0.0 metric 1 if %IF_INDEX%
> route add 128.0.0.0 mask 128.0.0.0 0.0.0.0 metric 1 if %IF_INDEX%
> 
> echo Done. To revert, run:
> echo route delete 0.0.0.0 mask 128.0.0.0
> echo route delete 128.0.0.0 mask 128.0.0.0
> pause
> 2. Linux (Shell)
> 保存为 setup_tun_linux.sh，执行 sudo sh setup_tun_linux.sh tun0。
> 
> #!/bin/sh
> TUN_NAME=$1
> 
> if [ -z "$TUN_NAME" ]; then
>     echo "Usage: sudo sh $0 <TunName>"
>     exit 1
> fi
> 
> # 启用网卡
> ip link set "$TUN_NAME" up
> 
> # 添加两段路由覆盖全网
> ip route add 0.0.0.0/1 dev "$TUN_NAME"
> ip route add 128.0.0.0/1 dev "$TUN_NAME"
> 
> echo "Routing table updated for $TUN_NAME."
> 3. macOS (Shell)
> 保存为 setup_tun_mac.sh，执行 sudo sh setup_tun_mac.sh utun1。
> 
> #!/bin/sh
> TUN_NAME=$1
> 
> if [ - … *[truncated]*

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/9063#issuecomment-4243363027)

> 我的想法，这个 pr 先把 windows 平台支持做了吧，应该只加不减
> 
> CoreConfigContext 那边加个默认网口和 TUN Name，然后 CoreConfigContext.IsTunEnabled 指示是否启用当前核心 TUN，CoreConfigContext.AppConfig 的那个 TUN 表示全局状态


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
