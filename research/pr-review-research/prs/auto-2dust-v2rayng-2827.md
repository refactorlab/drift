# 2dust/v2rayNG #2827 — added support for multiple custom configs in subscriptions + remarks

**[View PR on GitHub](https://github.com/2dust/v2rayNG/pull/2827)**

| | |
|---|---|
| **Author** | @vfarid |
| **Status** | ✅ merged |
| **Opened** | 2024-02-09 |
| **Repo importance** | ★57,543 · 7,532 forks · score 92,650 |
| **Diff** | +80 / −47 across 3 files |
| **Engagement** | 32 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @AliM1988 — 3 reactions  
`👍 3`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1937403962)

> @vfarid Thank you. Please give a sample including 2 custumConfigs with remark.

### @AliM1988 — 3 reactions  
`👍 2 · 🚀 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1938096493)

> @vfarid @2dust  I tested below single-config. It can be imported via subscription successfully, but the "remarks" field doesn't appeared in imported config.
> ```
> {
>   "remarks": "serv1",
>   "log": {
>     "access": "",
>     "error": "",
>     "loglevel": "warning"
>   },
>   "inbounds": [
>     {
>       "tag": "socks",
>       "port": 10808,
>       "listen": "127.0.0.1",
>       "protocol": "socks",
>       "sniffing": {
>         "enabled": true,
>         "destOverride": [
>           "http",
>           "tls"
>         ],
>         "routeOnly": false
>       },
>       "settings": {
>         "auth": "noauth",
>         "udp": true,
>         "allowTransparent": false
>       }
>     },
>     {
>       "tag": "http",
>       "port": 10809,
>       "listen": "127.0.0.1",
>       "protocol": "http",
>       "sniffing": {
>         "enabled": true,
>         "destOverride": [
>           "http",
>           "tls"
>         ],
>         "routeOnly": false
>       },
>       "settings": {
>         "auth": "noauth",
>         "udp": true,
>         "allowTransparent": false
>       }
>     }
>   ],
>   "outbounds": [
>     {
>       "tag": "proxy",
>       "protocol": "vless",
>       "settings": {
>         "vnext": [
>           {
>             "address": "xxx",
>             "port": 443,
>             "users": [
>               {
>                 "id": "f3e0bd10-e133-11ed-ace2-1495dbb28315",
>                 "alterId": 0,
>                 "email": "t@t.tt",
>                 "security": "auto",
>                 "encryption": "none",
>                 "flow": ""
>               }
>             ]
>           }
>         ]
>       },
>       "streamSettings": {
>         "network": "ws",
>         "security … *[truncated]*

### @vfarid — 3 reactions  
`👍 3`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1945798500)

> Because 1.8.15 dosent support it, its in master branch and will be available in next release.

### @X-Oracle — 2 reactions  
`👍 2`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1961144335)

> > Hi @vfarid,
> > 
> > I encountered an issue while importing custom configurations. When I import custom configurations from my sub-link, some integer values are being displayed as float values in the program. This issue is causing my configurations to malfunction. But when I copy the configuration from the browser and import it, the issue does not occur.
> > 
> > Do you have any ideas on how to resolve it?
> > 
> > Configuration when imported:
> > ![Screenshot_۲۰۲۴۰۲۲۳-۱۳۰۱۵۷_v2rayNG](https://github.com/2dust/v2rayNG/assets/72671131/3dd54c95-f26d-42c9-85c9-2b439d879b99)
> > 
> > Configuration in the browser:
> > ![image](https://github.com/2dust/v2rayNG/assets/72671131/6289dde8-24b0-4821-ab0c-02e268782df0)
> > 
> > 
> 
> The problem is how it parses Json.
> It converts 8 to 8.0 which is not compatible with uint32.
> 
> It seems to have effect only on inbounds

### @AliM1988 — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1951266096)

> > I wish the remark can also work on single custom config, please.
> 
> You can just encapsulate  your single-config in [ ]

### @vfarid — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayNG/pull/2827#issuecomment-1956362679)

> > What if we want to deliver like 100 configs to user? 100kb of config file? @vfarid Isn't better to make multiple dummy Inbounds and route each one to an outbound Inbound tag = Config name Client could erase other inbounds and change the selected Inbound and use that inbound and it's routes This could be the next Standard for all xray-core clients
> 
> Its not that heavy, btw the custom config format is detailed in xray-core. To keep compatibility, we need to follow the format. Furtheremore webservers usually  gzip the output and they will reduce the boundle size using compression.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
