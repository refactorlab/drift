# kubernetes/enhancements #4384 — KEP 4381: add structured parameters for dynamic resource allocation

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/4384)**

| | |
|---|---|
| **Author** | @pohly |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @johnbelamaric
> I think this and the related KEPs are going in the right direction...I am wondering though if we can build a more structured and comprehensive model up front, rather than the model being a sort of flat list of parameters.

### @thockin
> People want to glob, substring, prefix, or regex match kube selectors, too. Just say no...You have a stringly-typed structure. Ideally you would decompose this into actual atoms of information.

### @pohly
> The parameters don't need to be a flat list. Anything that is allowed in a CRD could be used. How complex the in-tree model needs to (and should) be is something that we can discuss...

### @johnbelamaric
> From a paperwork perspective, I think we should include all the models in this KEP, rather than separate KEPs...I do think we should consider how far we can push this. If we can eliminate the need for the driver-by-driver back and forth communication via PodSchedulingContext...

### @pohly
> We loose the following functionality if we remove PodSchedulingContext: Support for network-attached resources...Support use cases which don't fit into the proposed numeric models...

### @thockin
> My comments are little all over the place...I think the priority here is to get something that helps us prove this overall model...this can safely be less than MVP, so we can work with autoscaling and scheduling to make sure it works.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
