# kubevirt/kubevirt #15123 — VMpool: Add UpdateStrategy support with Proactive, Opportunistic modes and Selection policies

**[View PR on GitHub](https://github.com/kubevirt/kubevirt/pull/15123)**

| | |
|---|---|
| **Author** | @Sreeja1725 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @0xFelix
> Can you add a unit test for the validation that was added to the admitter?

### @xpivarc
> Do we plan to have e2e coverage for this?

### @iholder101
Questioned the organization of selection policies and requested clarification on how different policy types interact with update modes. (Paraphrased — verbatim text not cleanly extractable from the rendered conversation page.)

### @fossedihelm
Requested changes addressing how proactive versus opportunistic modes handle VM selection and scheduling decisions. (Paraphrased — verbatim text not cleanly extractable from the rendered conversation page.)

### @0xFelix
Multiple comments asking for improved naming and documentation around update strategy logic in the pool controller to enhance maintainability. (Paraphrased — verbatim text not cleanly extractable from the rendered conversation page.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
