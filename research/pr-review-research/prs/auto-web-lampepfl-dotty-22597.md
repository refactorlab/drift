# lampepfl/dotty #22597 — Add expression compiler

**[View PR on GitHub](https://github.com/lampepfl/dotty/pull/22597)**

| | |
|---|---|
| **Author** | @adpi2 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sjrd
> After `Typer`, the pickler phases, `ExtensionMethods` and `ElimByName`

(Questioned whether extraction timing could interfere with lambda lifting transformations.)

### @sjrd
> Requested clarification on the reflectEval callback mechanism and its interaction with compiler diagnostics infrastructure.

### @sjrd
> Suggested improvements to the `DebugTests` framework regarding test file organization and the separation of debug step assertions from test execution logic.

### @tgodzik
> Looks like the tests are not compiling due to usage of newer JDK API?

(Noted requirement to configure sbt-jdi-tools for Java 8 support.)

### @tgodzik
> Recommended creating a separate issue for moving reflection utility methods into scala3-library rather than embedding them in the compiler phases.

### @tgodzik
> Noted that warnings from expression compilation were being ignored and suggested deferring warning reporting to a future enhancement.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
