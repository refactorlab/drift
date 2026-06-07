# kubernetes/enhancements #5347 — KEP-5328:Node Declared Features (formerly Node Capabilities)

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/5347)**

| | |
|---|---|
| **Author** | @pravk03 |
| **Status** | ✅ merged |
| **Opened** | 2025-05-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +1066 / −0 across 3 files |
| **Engagement** | 37 conversation · 435 inline review comments |

## Top review comments (ranked by reactions)

### @tallclair — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-2992205845)

> > Maybe past examples or hypothetical examples thought thru end-to-end. Right now this KEP is limited to just set of name/value pairs and a scenario of FG discoverability.
> 
> I feel like we've discussed these options in depth already. Yes, these are all somewhat hypothetical because we've had to work around them in other ways. I'm sure we can dig up more examples from past KEPs, but is that necessary?
> 
> Capabilities that are not limited to just feature gates:
> - swap enabled
> - static CPU / memory manager enabled
> - user namespace support
> 
> Feature gate capabilities:
> - pod-level resources
> - TLS for gRPC probes
> - in-place resize (+IPPR for pod-level resources, IPPR for static CPU assignment, etc)
> 
> > But already we are thinking there MAY be need to support capabilities for node selection, ability to declare tolerations for capabilities,
> 
> Not sure what node selection means, but we've explicitly said tolerations are out of scope.
> 
> > ability to have node-restricted capabilities. 
> 
> Where did this come in? Capabilities are just added by the node, so I'm not sure what this would even mean.

### @pravk03 — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-2992585463)

> We discussed this KEP today and decided to re-consider this for 1.35 release cycle. The primary reason is to get input from`sig-arch` on using this capability-based framework as a general strategy for managing version skew.
> 
> Few more things discussed and that could be refined in the proposal: 
> 1. Evaluate the strategy for managing capabilities with bounded lifetime. Define a clear lifecycle and deprecation path for capabilities tied to features that graduate to GA.
> 2. We would need a better use-case to consider long-term capabilities in-scope. It can be considered a future enhancement once a clear use case arises.
> 3. Further explore SemVer based filtering in Node Selectors as a potential alternative.
> 
> cc @tallclair @SergeyKanzhelev @dchen1107 @yujuhong

### @macsko — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-2985256569)

> The scheduling part looks good for alpha
> /approve as SIG Scheduling

### @tallclair — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-2986034668)

> It seems like most of the concerns with this are around the specific capabilities being added, but this KEP doesn't actually propose adding any capabilities. The examples given are hypothetical examples based on features currently in development, but no new features will be able to depend on capabilities until it goes to beta. This creates a bit of a chicken-and-egg situation, where it's hard to point to exactly how capabilities will be used until we have users lined up, but we can't line up users yet.

### @pravk03 — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-3165677409)

> @tallclair @SergeyKanzhelev I have updated the KEP based on the last round of feedback. PTAL when you get a chance.
> 
> @macsko  @dom4ha Could you please take another look from the SIG scheduling side. The most significant architectural change is that capability inference logic has been moved out of the scheduler and into a new shared library. This ensures the kube-scheduler plugin remains generic and does not need to be modified for each new capability introduced in the future

### @liggitt — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/5347#issuecomment-3365678363)

> REST API bit looks good from an API perspective


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
