# dbt-labs/dbt-core #13029 — Add --use-v2-parser to delegate parsing to the fusion parser

**[View PR on GitHub](https://github.com/dbt-labs/dbt-core/pull/13029)**

| | |
|---|---|
| **Author** | @aiguofer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @codescene-delta-analysis
> ❌ Getting worse: **Complex Method** setup_manifest increases in cyclomatic complexity from 12 to 13, threshold = 9

(Inline comment on lines 462-478 of `core/dbt/cli/requires.py`, flagging that the `setup_manifest` function crossed the complexity threshold and could benefit from refactoring.)

### @tauhid621
Flagged platform-specific failures: "Windows tests are failing due to two issues." This surfaced Windows path-handling and subprocess-invocation problems in the fusion parser command parsing that required fixes across multiple commits.

### @colin-rogers-dbt
Drove a visibility decision via the commit "Unhide --use-v2-parser," indicating the flag should be user-facing rather than hidden/experimental.

### CodeScene analysis
Identified additional code-health issues, including a "Complex Method" in `fusion.py`'s `_build_argv` and complexity in `manifest.py`'s `read_manifest_for_partial_parse`.

### @Copilot
Suggested an improved docstring (applied via autofix) clarifying the behavior and parameters of the `parse_with_fusion` function.

*Note: several human review threads were paraphrased on the conversation page rather than rendered verbatim; the inline CodeScene quote above is verbatim.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
