# kubernetes/enhancements #4384 — KEP 4381: add structured parameters for dynamic resource allocation

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/4384)**

| | |
|---|---|
| **Author** | @pohly |
| **Status** | ✅ merged |
| **Opened** | 2024-01-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +1402 / −0 across 3 files |
| **Engagement** | 55 conversation · 362 inline review comments |

## Top review comments (ranked by reactions)

### @pohly — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1925217814)

> > > I think we should consider ... modeling the underlying card .... Add in some lifecycle information (for example, readiness conditions...), and we have a pretty complete model.
> > 
> > Given the potential of multiple schedulers (or even just one scheduler with lots of work to do) we need to provide some way of resolving races where 2 mutually-incompatible decisions about the same device happen in a short time period, especially if the status update has to go thru a number of actors. E.g. Scheduler decides that node A should run pod 1, which necessitates "mode=X". The kubelet sees the pending pod, and the DRA driver (on-node) does the mode=X switch. Kubelet needs to update the node resources to indicate "currently mode=X", but kubelet is not instantaneous for status. Meanwhile scheduler decides that node A should run pod 2, which wants mode=Y. Eventually the node has to NAK pod 2.
> 
> Do people really run multiple schedulers so that they all schedule to the same node? The same "can't run pod" problem then also occurs for all other resources (RAM/CPU, extended resources) because each individual scheduler thinks it can calculate how much of those are left. That's not true anymore when someone else schedules to the same node, which reduces how much is left.
> 
> > How much do we try to avoid the failed attempt? Yes, it can already happen with CPU and memory but mode-switched devices are far scarcer, so it SEEMS more likely. But I do not have data.
> 
> My assumption was that because it's already a bad idea, people don't do it and use different schedulers for disjunct set of nodes.
> 
> @alcul … *[truncated]*

### @johnbelamaric — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1894712283)

> @pohly I think this and the related KEPs are going in the right direction. It will be interesting to see how many use cases we can cover with these.
> 
> I am wondering though if we can build a more structured and comprehensive model up front, rather than the model being a sort of flat list of parameters. The drivers would publish those to a resource just like you have here, but would also allows some topological considerations baked into the structure. The goal is to get to a place where the scheduler and autoscalers (workload or cluster) have enough information to get the right answer the vast, vast majority of time. The drivers would likely also need to publish information on the valid "transformations" of the model when reservations are done.
> 
> I am also not sure of the way this "peers into" driver-specific data structures for parameters. I see why you are doing it that way, but it creates some fragility between resources when we have those sort of field paths. I think we can explore some other approaches. For example, a schema of some sort for describing the resource model, which results in those parameter CRDs for the user to use, but attaches the resource management metadata to those types as well, for the scheduler and autoscalers to use. We can brainstorm some of this when we talk next.

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1895226325)

> > I am wondering though if we can build a more structured and comprehensive model up front, rather than the model being a sort of flat list of parameters. 
> 
> The parameters don't need to be a flat list. Anything that is allowed in a CRD could be used. How complex the in-tree model needs to (and should) be is something that we can discuss in https://github.com/kubernetes/enhancements/pull/4384, with https://docs.google.com/document/d/1XNkTobkyz-MyXhidhTp5RfbMsM-uRCWDoflUMqNcYTk/edit#heading=h.ljj9kaa144nr as a starting point.
> 
> > a schema of some sort for describing the resource model, which results in those parameter CRDs for the user to use, but attaches the resource management metadata to those types as well, for the scheduler and autoscalers to use
> 
> So basically a configurable mapping of fields in a vendor CRD to the in-tree numeric model type? That adds more flexibility, but also complexity. I don't see how it addresses the "fragility between resources" - instead of one configurable field path, we would have many. Perhaps being explicit about all paths would help. :shrug:

### @johnbelamaric — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1911482539)

> To sort of answer my own question, I realized I got myself confused. We need three things, not two:
> * the capacity object (which will live in NodeResourceCapacity)
> * the capacity *request* object (which for counters is identical to the capacity object)
> * the capacity request expression object (defines the expressions used to generate a capacity request object from the CR)
> 
> I am assuming here that the capacity objects themselves, as stored in the NodeResourceCapacity, have a name or other identifier that we match to the capacity request object.
> 
> For how you "apply" the request to the current capacity, we could either have it be inherent in the numerical model type, or we can add an expression (and perhaps validation) object for that purpose too.

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1911952128)

> > From a paperwork perspective, I think we should include all the models in this KEP, rather than separate KEPs. Even if we don't implement all the models in 1.30, we can decide which ones are required to go to beta in the beta criteria.
> 
> I'm open to merging things. I'm just a bit worried that it will become harder to associate use cases and PRR sections with the right feature. I can try and we'll see what the outcome will be.
> 
> Related to this, how many feature gates do we want for this? We could make this granular (current proposal):
> 
> - DynamicResourceAllocation = core DRA
> - DRANumericParameters = this extension
> - DRACounterNumericModel = counter model
> - DRAModeSwitchModel = mode switch model
> 
> Do we agree on this?
> 
> > I do think we should consider how far we can push this. If we can eliminate the need for the driver-by-driver back and forth communication via PodSchedulingContext that would go a long way towards alleviating concerns on the overall DRA KEP.
> 
> We loose the following functionality if we remove PodSchedulingContext:
> - Support for network-attached resources: not covered because it would raise additional questions around how allocation can make the relevant resource configuration changes when there is no vendor-provided control plane controller.
> - Support use cases which don't fit into the proposed numeric models and don't need autoscaling. Such cases exist.
> 
> IMHO these are important enough to keep the core DRA as originally envisioned.
> 
> > I realize (at least I think this is true) that that process also covers node-side allocation failures pushing a pod back into t … *[truncated]*

### @ffromani — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/enhancements/pull/4384#issuecomment-1911991726)

> > Triggering pod rescheduling in kubelet is going to be a separate KEP from @ffromani . DRA is avoiding the problem as much as possible by making sure that resources are set aside before the scheduling decision.
> 
> Correct. We agreed to kept this part separated as it is related but not a dependency for DRA progress. Of course the needs and potential benefits for DRA enabled by rescheduling is going to be a very major theme in the pod rescheduling conversation. I'm currently processing all the feedback received from the conversations with various SIGs, will update the design document ASAP.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
