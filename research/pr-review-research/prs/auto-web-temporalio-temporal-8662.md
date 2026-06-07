# temporalio/temporal #8662 — Add implementation of CHASM List/Count Runs

**[View PR on GitHub](https://github.com/temporalio/temporal/pull/8662)**

| | |
|---|---|
| **Author** | @awln-temporal |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bergundy
> Just please document all of the exported functions. CHASM will be used by a lot of developers and we want to help people out as much as possible.

### @yycptt
> why we need to take in both?

### @yycptt
> hmm I think now that we are using proto.Message we no longer have guarantee that there's no error upon encoding in task executor, but guess that should never happen.

### @yycptt
> is it possible to reuse the corresponding definitions in chasm package and thus avoiding the conversion between the different struct definition

### @bergundy
> I think we can probably use generics here and have just a single `Get` method.

### @rodrigozhou
> `NamespaceID` is what we store in persistence, and `NamespaceName` is needed for dynamic config and custom search attributes mapper.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
