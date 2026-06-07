# traefik/traefik #12318 — NGINX Ingress Controller to Traefik Migration Guide

**[View PR on GitHub](https://github.com/traefik/traefik/pull/12318)**

| | |
|---|---|
| **Author** | @sheddy-traefik |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @immanuelfodor
> The guide is well-written and detailed enough, but maybe this is why I also got confused about the several steps, which is my main issue.

### @darkweaver87
> Generally we have two options to do this: add traefik endpoints to LoadBalancer [or] run traefik along NginX and do DNS roundrobin. In both cases, this should be progressive

### @kamilhristov
> if you install Traefik with publishService enabled (like the docs say), it updates the Ingress status with its own LB IP...What worked for me: Install Traefik in 'shadow' mode (disable publishService)

### @immanuelfodor
> I like the zero-downtime rewrite, the flow is now super clear.

### @mloiseleur
> It's widely used, so it makes sense to explain in this guide how to include it in the equation.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
