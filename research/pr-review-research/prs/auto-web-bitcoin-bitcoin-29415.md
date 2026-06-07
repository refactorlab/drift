# bitcoin/bitcoin #29415 — Broadcast own transactions only via short-lived Tor or I2P connections

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/29415)**

| | |
|---|---|
| **Author** | @vasild |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @epiccurious
> If there were eventually a change to force clearnet transactions over v2 transport (so the details of the communications were encrypted), would that solve the same problem that this PR is aiming to solve?

### @vasild
> p2p encryption 'solves' the spying from intermediate routers on clearnet...But there is more - it will as well solve issues with spying bitcoin nodes.

### @ArmchairCryptologist
> Instead of only establishing the 11th connection on-demand when a transaction is scheduled, would it not be significantly stealthier to establish the 11th connection...beforehand if privatebroadcast is set?

### @vasild
> When peer A connects to peer B and sends them a private broadcasted transaction...the pattern is just too revealing, even if we prolong the connection duration.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
