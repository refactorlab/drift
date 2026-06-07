# kubernetes/kubernetes #127525 — fix: pods meeting qualifications for static placement when cpu-manager-policy=static should not have cfs quota enforcement

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/127525)**

| | |
|---|---|
| **Author** | @scott-grimes |
| **Status** | ✅ merged |
| **Opened** | 2024-09-21 |
| **Diff** | +571 / −116 across 17 files |
| **Engagement** | 104 conversation comments · 141 inline review comments |

## Why this PR is notable

A static-CPU-placement bug fix in the kubelet. `odinuge` **reproduces the behavior locally** with a full manifest before commenting; `ffromani` commits to a release cycle and posts a **ready-to-apply diff** that fixes a failing e2e test.

## 🧠 The lesson for reviewers

> The tightest review loop is zero round-trips: reproduce locally, then hand the author the exact patch. Reviewers who do the work get the fix merged faster.

## How the author framed it (PR description excerpt)

> #### What type of PR is this?
> /kind bug
> 
> #### What this PR does / why we need it:
> 
> When `cpu-manager-policy=static` and the qualifications for static cpu assignment are satisfied (i.e. Containers have `Guaranteed` QOS with integer CPU `requests`) cfs quota is disabled.
> 
> #### Which issue(s) this PR fixes:
> Fixes #70585
> 
> #### Does this PR introduce a user-facing change?
> 
> ```release-note
> When cpu-manager-policy=static is configured containers meeting the qualifications for static cpu assignment (i.e. Containers with integer CPU `requests` in pods with `Guaranteed` QOS) will not have cfs quota enforced. Because this fix changes a long-established behavior, users observing a regressions can use the DisableCPUQuotaWithExclusiveCPUs feature gate (default on) to restore the old behavior. Please file an issue if you encounter problems and have to use the Feature Gate.
> ```
> 
> #### Additional documentation e.g., KEPs (Kubernetes Enhancement Proposals), usage docs, etc.:
> 
> When `cpu-manager-policy=static`:
> 
> 1) container level cgroup: The container-level cpu limit per container (init, application, sidecar) is removed when the container has a dedicated CPU
> 2) pod level cgroup: The pod-level cpu limit is removed when **any** container  in the pod has a dedicated CPU
> 
> Note that containers (init, application, sidecar) within a pod are allocated a dedicated CPU when all of the following are true:
> 
> *    cpumanager policy is static
> *    pod has QoS guaranteed
> *    the container has integer cpu request
> 
> This logic is encapsulated in the static policy per
> 
> [kubernetes/pkg/kubelet/cm/cpumanager/policy_static.go](https://github.com/kubernetes/kubernetes/blob/02fd991c5b3d1b705658633a93f8d8aae2c694bb/ …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @odinuge — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/127525#issuecomment-2513980204)

> I did a quick test locally to ensure I understand the code correctly;
> ```bash
> $ kubectl apply -f - <<EOF
> apiVersion: v1
> kind: Pod
> metadata:
>   name: alpine-reserved-cpu
>   namespace: default
> spec:
>   containers:
>   - command:
>     - sleep
>     - "1235"
>     image: alpine
>     name: one
>     resources:
>       limits:
>         cpu: "1"
>         memory: 100Mi
>       requests:
>         cpu: "1"
>         memory: 100Mi
>   - command:
>     - sleep
>     - "1235"
>     image: alpine
>     name: two
>     resources:
>       limits:
>         cpu: 200m
>         memory: 100Mi
>       requests:
>         cpu: 200m
>         memory: 100Mi
> ---
> apiVersion: v1
> kind: Pod
> metadata:
>   name: alpine-no-reserved-cpu
>   namespace: default
> spec:
>   containers:
>   - command:
>     - sleep
>     - "1235"
>     image: alpine
>     name: one
>     resources:
>       limits:
>         cpu: "2"
>         memory: 100Mi
>       requests:
>         cpu: "1"
>         memory: 100Mi
>   - command:
>     - sleep
>     - "1235"
> EOF
> 
> $ kubectl exec -it alpine-no-reserved-cpu -c one -- sh -x -c "cat /sys/fs/cgroup/cpuset.cpus; cat /sys/fs/cgroup/cpu.max"
> + cat /sys/fs/cgroup/cpuset.cpus
> 1-11
> + cat /sys/fs/cgroup/cpu.max
> 200000 100000
> 
> $ kubectl exec -it alpine-no-reserved-cpu -c two -- sh -x -c "cat /sys/fs/cgroup/cpuset.cpus; cat /sys/fs/cgroup/cpu.max"
> + cat /sys/fs/cgroup/cpuset.cpus
> 1-11
> + cat /sys/fs/cgroup/cpu.max
> 20000 100000
> 
> $ kubectl exec -it alpine-reserved-cpu -c one -- sh -x -c "cat /sys/fs/cgroup/cpuset.cpus; cat /sys/fs/cgroup/cpu.max"
> + cat /sys/fs/cgroup/cpuset.cpus
> 0
> + cat /sys/fs/cgroup/cpu.max
> max 100000
> 
> $ kubectl exec -it alpine-reserved-cpu -c two -- sh -x -c "cat /sys/fs/cgroup/cpuset.cpus; cat /sys/fs/cgroup/cpu.max"
> + cat /sys/fs/cgroup/cpuset.cpus
> 1- …​ *[truncated]*


### @ffromani — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/127525#issuecomment-2578343871)

> I'm committed to merge this in the 1.33 cycle (the earlier the better)


### @ffromani — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/127525#issuecomment-2583377707)

> this seems to fix for me (includes cosmetic chages), PTAL:
> 
> ```
> diff --git a/test/e2e_node/cpu_manager_test.go b/test/e2e_node/cpu_manager_test.go
> index f06cef06c61..85ecb6fdad3 100644
> --- a/test/e2e_node/cpu_manager_test.go
> +++ b/test/e2e_node/cpu_manager_test.go
> @@ -724,23 +724,24 @@ func runCfsQuotaGuPods(ctx context.Context, f *framework.Framework, disabledCPUQ
>                 },
>         }
>  
> -       podCFSCheckCommand := []string{"sh", "-c", `cat $(find /sysfscgroup | grep "$(cat /podinfo/uid | awk 's/-/_/g').slice/cpu.max$") && sleep 1d`}
> +       podCFSCheckCommand := []string{"sh", "-c", `cat /sysfscgroup/kubepods/pod$(cat /podinfo/uid )/cpu.max && sleep 1d`}
>  
>         pod5 := makeCPUManagerPod("gu-pod5", ctnAttrs)
>         pod5.Spec.Containers[0].Command = podCFSCheckCommand
>         pod5 = e2epod.NewPodClient(f).CreateSync(ctx, pod5)
>         cleanupPods = append(cleanupPods, pod5)
> -
>         ginkgo.By("checking if the expected cfs quota was assigned to pod (GU pod, unlimited)")
>  
>         expectedQuota = "100000"
> +
>         if disabledCPUQuotaWithExclusiveCPUs {
>                 expectedQuota = "max"
>         }
> +
>         expCFSQuotaRegex = fmt.Sprintf("^%s %s\n$", expectedQuota, defaultPeriod)
> +
>         err = e2epod.NewPodClient(f).MatchContainerOutput(ctx, pod5.Name, pod5.Spec.Containers[0].Name, expCFSQuotaRegex)
> -       framework.ExpectNoError(err, "expected log not found in container [%s] of pod [%s]",
> -               pod5.Spec.Containers[0].Name, pod5.Name)
> +       framework.ExpectNoError(err, "expected log not found in container [%s] of pod [%s]", pod5.Spec.Containers[0].Name, pod5.Name)
>  
>         ctnAttrs = []ctnAttribute{
>                 {
> @@ -760,9 +761,7 @@ fun …​ *[truncated]*


### @ffromani — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/127525#issuecomment-2583632477)

> correction: let's check the quota calculation. I think we need something like
> ```
> [...]
>         ginkgo.By("checking if the expected cfs quota was assigned to pod (GU pod, unlimited)")
>  
>        expectedQuota = "150000" // half a core plus a full core
> [...]
> ```


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
