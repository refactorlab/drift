# facebook/docusaurus #11327 — feat(search): add runtime support for DocSearch v4

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/11327)**

| | |
|---|---|
| **Author** | @dylantientcheu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @slorber
> DocSearch v4 is still in beta, and I'm seeing it being still actively worked on. We can't prevent our users from upgrading to the latest Docusaurus v3.x release due to changes you make that affect us.

### @slorber
> The design changes coming with DocSearch v4 are significant enough to disrupt existing sites, that may inadvertently ship DocSearch v4 to production without knowing.

### @slorber
> To me, the most disruptive design/UX change you include in DocSearch v4 is the larger search bar button...the React Native website would have its title elipsed for some screen sizes.

### @slorber
> Upgrading Algolia to support AskAI makes our main bundle 325 kb heavier...it will be the case even if users don't enable AskAI.

### @slorber
> Due to a 300+kb main bundle size increase, we are going to support DocSearch v4 at runtime, but won't use DocSearch v4 by default until that issue is solved.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
