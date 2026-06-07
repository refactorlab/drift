# lit/lit #4575 — [labs/nextjs, labs/ssr-react, lit/react] Add support for Next.js v14 and App Router

**[View PR on GitHub](https://github.com/lit/lit/pull/4575)**

| | |
|---|---|
| **Author** | @augustjk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AndrewJakubowicz
> When is `props.children` an Array that hasn't be handled by the `.length > 0` check above?

### @augustjk
> the params come like this function createElement(type, props, ...children) {} If children are provided as 3rd+ arguments, `children.length > 0` is true and we use that.

### @AndrewJakubowicz
> Absolutely awesome work!

### @justinfagnani
> lgtm!

> **Note:** Most substantive design discussion on this PR occurred in code-review threads that loaded incompletely on the fetched conversation page; the verbatim comments above are those that rendered.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
