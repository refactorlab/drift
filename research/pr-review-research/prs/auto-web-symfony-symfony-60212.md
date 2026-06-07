# symfony/symfony #60212 — [Form] Add `FormFlow` for multistep forms management

**[View PR on GitHub](https://github.com/symfony/symfony/pull/60212)**

| | |
|---|---|
| **Author** | @yceruto |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @javiereguiluz
> The most common names for this type of forms are 'multi-step form' or 'stepped form'... The word 'flow' in this context seems a bit vague to me.

### @RafaelKr
> This was one of the big challenges we had to solve with CraueFormFlowBundle... file uploads. It would be very helpful to have a default way the FormFlow can handle file uploads.

### @stof
> This would be incompatible with apps using a load balancer with several servers... Such case require storing uploads in a shared storage.

### @chalasr
> I like `Flow` instead of `MultiStep`... Even if it's less common, it's a cool name that does convey the feature's purpose.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
