# crossplane/crossplane #6255 — Proposal: Crossplane v2

**[View PR on GitHub](https://github.com/crossplane/crossplane/pull/6255)**

| | |
|---|---|
| **Author** | @negz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bobh66
> Breaking that is a showstopper for us. I'm also a little concerned that the 'legacy' modes would become second-class citizens...A phased implementation will be important to ensure continuity.

### @nakamume
> Currently we create namespaces for our users...This kept the RBAC simple both for us, platform team, and our users. I wonder how it would be done when everything is namespaced.

### @clementblaise
> While I see many advantages to having Namespaced MR and Composites, I agree with others that losing the ability to choose foreground deletion would be a deal breaker.

### @mproffitt
> How would crossplane manage observe-only resources for in-cluster MRs in this manner...Would an in-cluster O-O MR be able to observe across namespace?

### @chlunde
> Should extra resources support namespace resourced with v2?

### @jbw976
> Do you think that we should wait until we have a ReferenceGrant-like API before we enable/allow cross namespaced references on MRs?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
