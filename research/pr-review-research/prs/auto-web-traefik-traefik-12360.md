# traefik/traefik #12360 — Reject suspicious encoded characters

**[View PR on GitHub](https://github.com/traefik/traefik/pull/12360)**

| | |
|---|---|
| **Author** | @rtribotte |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @emilevauge
> Could you add a dedicated section in docs/content/security? Shouldn't we add something in [migration docs] as well?

### @TsengSR
> may I ask what triggered this PR in the first place? Its more than very odd to reject Request paths with %2f etc. These are very common, especially when redirecting or authentication

### @ChristianCiach
> Traefik is not a firewall...blocking certain special characters by default. The more I think about this, the more I believe that this kind of protection should be implemented as a middleware.

### @CybotTM
> Yes, but by fixing the routing, not brute-deny legit URL parts. As long as Traefik matches router rules against path view A, but later forwards a differently normalized or decoded path view B, the system is inherently unsafe.

### @lastzero
> The CVE's severity is based on a threat model where Traefik is a security gateway for path-based access control in front of backends that decode reserved characters.

### @emilevauge
> Based on your input, here's the direction we're taking: v2.11.35 - v3.6.7: We will revert Traefik's behavior...v3.7.0: We will introduce a new middleware

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
