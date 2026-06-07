# kubevirt/kubevirt #13744 — virt-launcher, nichotplug: Manage Link State for vNICs

**[View PR on GitHub](https://github.com/kubevirt/kubevirt/pull/13744)**

| | |
|---|---|
| **Author** | @nirdothan |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @orelmisan
> AFAIU, both the VM and VMI interfaces and networks should remain unchanged.

### @EdDev
> I do not think it is a valid English, you need to use plural on both links and states.

### @EdDev
> In a scenario where a simple hotplug is performed, the `currentDomain` is not expected to include the new interface, so we are suppose to fail here. But we are not suppose to fail here because the hotplug was already handled by `hotplugVirtioInterface`.

### @fossedihelm
> Consider using the `DomainSpec` as a parameter instead of `Domain`. Same for `hotplugVirtioInterface`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
