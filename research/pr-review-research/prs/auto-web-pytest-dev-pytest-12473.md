# pytest-dev/pytest #12473 — (fixtures): Replace fixture representation with a class

**[View PR on GitHub](https://github.com/pytest-dev/pytest/pull/12473)**

| | |
|---|---|
| **Author** | @Glyphack |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @RonnyPfannschmidt
> I believe we can drop fixture definition from that, we should pass the definitions attribute

### @webknjaz
> Could you assert against a more specific exception? As I understand, this is not testing that _something_ went wrong but it's not clear what exactly.

### @RonnyPfannschmidt
> Decorators cannot apply to a fixture definition. So that should trigger a error. It's wrong even now.

### @bluetech
> Merging as-is would introduce a typing regression (fixture functions would lose their signature). But it's only temporary so not a problem.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
