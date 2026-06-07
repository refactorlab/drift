# astral-sh/ruff #13636 — [red-knot] type inference/checking test framework

**[View PR on GitHub](https://github.com/astral-sh/ruff/pull/13636)**

| | |
|---|---|
| **Author** | @carljm |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MichaReiser
> The one design change that I propose is to make the pragma comments lower case because that's the most commonly used style used in the python community

### @MichaReiser
> I suggest moving the tests itself to the `red_knot_python_semantic` crate. See my inline comment. We should also add a `README` explaining the test structure.

### @MichaReiser
> I think it should work as expected but could you add a test for a parenthesized expression

### @MichaReiser
> We should reduce the pulled in dependencies...don't pull in default features of rstest

### @AlexWaygood
> I'd love some more doc-comments for some of these methods :)

### @carljm
> I'm preferring this over stacked PRs, since the GH UX for stacked PRs is so bad. I encourage reviewers to use the GH feature to narrow review per-commit

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
