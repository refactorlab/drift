# kubevirt/kubevirt #14365 — VEP-10: Add support for DRA devices in VMI

**[View PR on GitHub](https://github.com/kubevirt/kubevirt/pull/14365)**

| | |
|---|---|
| **Author** | @alaypatel07 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @xpivarc
> We need to enforce one of

(regarding mutually exclusive fields for DeviceName vs DRA device specification in the schema)

### @xpivarc
> Please move this and the content of dra-demo to examples

### @xpivarc
> Not sure about this one but it seems we did not wait for the cluster config sync so this might be flaky

### @xpivarc
> I would not condition this

(objecting to conditional logic that gates controller startup based on feature flags)

### @xpivarc
> Seems to me that unit tests are wrong

### @iholder101
> revisit FG enablement in admission time

(flagging technical debt for follow-up in the beta phase, alongside "default amount of controller threads")

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
