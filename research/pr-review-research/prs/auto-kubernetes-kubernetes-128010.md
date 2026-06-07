# kubernetes/kubernetes #128010 — Pod Certificates: Preliminary implementation of KEP-4317

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/128010)**

| | |
|---|---|
| **Author** | @ahmedtd |
| **Status** | ✅ merged |
| **Opened** | 2024-10-11 |
| **Repo** | curated review-culture seed |
| **Diff** | +19551 / −1389 across 173 files |
| **Engagement** | 26 conversation · 569 inline review comments |

## Top review comments (ranked by reactions)

### @tico88612 — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-2700234163)

> Hi @ahmedtd,
> We'd like to remind you of the code freeze time. If there's anything we can do, please let us know.
> The code freeze is starting 02:00 UTC Friday 21st March 2025 (about 3 weeks from now). Please make sure the PR has both lgtm and approved labels before the code freeze. Thanks!

### @tico88612 — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-2728298444)

> Hello, @ahmedtd @deads2k 
> Appreciate all of your efforts with this PR! Is the plan still to resolve it for v1.33 release?
> If so, a gentle reminder that the code freeze has started [02:00 UTC Friday 21st March 2025](https://everytimezone.com/s/2c5e9275) . Please make sure any PRs have both lgtm and approved labels ASAP, and file an [Exception](https://github.com/kubernetes/sig-release/blob/master/releases/EXCEPTIONS.md) if you haven't done it yet.
> Thanks!

### @ahmedtd — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-2730412755)

> @deads2k This is ready for another review pass.  Apologies, it took a lot longer than I expected to convert the Kubelet code to be informer-based, but I think it has significantly improved it.
> 
> There's one change from the last time you reviewed that I should call out:  I have locked down the allowable status conditions on PodCertificateRequest:
> 1) There can be only one condition entry.
> 2) It must be one of Issued, Denied, or Failed
> 3) The condition entry is immutable once it is set (similar to CSR).
> 
> This simplified a lot of the validation logic, and seems OK because
> 1) Only Kubelet is really consuming these conditions anyways.
> 2) We can relax the restrictions (for example, by permitting signers to add other informative conditions) in the future without compatibility concerns.
> 
> All other changes are just implementing review feedback.

### @ahmedtd — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-2978412637)

> For my own reference, here's the remaining large-ish items:
> 
> * PodCertificateManager unit tests (it's already covered by integration tests).  Unit tests may be challenging because checking the complete behavior requires a fairly complete kube-apiserver.  Maybe there's a way to launch kube-apiserver in process with a fake etcd?
> * Integration tests for Kubelet handling of static pods that request podCertificate volumes (Kubelet itself seems to have ~no integration test coverage currently... I will need to figure out a good approach for this).
> * Check owner reference functionality, as well as OwnerReferencesPermissionEnforcement admission plugin (this can probably be accomplished from the podcertificate manager integration test.

### @elieserr — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-3025684563)

> Hello @ahmedtd @deads2k 
> I can see this PR is actively being developed, so this is just a reminder from the release-signal team that code freeze is happening soon. If there's anything we can do, please let us know.
> 
> The code freeze is starting 02:00 UTC Friday 25th July 2025 (around 4 weeks from now). Please make sure the PR has both lgtm and approved labels before the code freeze. Thanks!

### @ahmedtd — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/128010#issuecomment-3058451574)

> > Keep the selector on pod because you can't debug easily without. Remove the one for serviceaccount.
> 
> Done.  Sorry, removing the line removed my ability to reply to the comment, because Github.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
