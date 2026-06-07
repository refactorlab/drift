# nrwl/nx #30457 — feat(gradle): add batch runner

**[View PR on GitHub](https://github.com/nrwl/nx/pull/30457)**

| | |
|---|---|
| **Author** | @xiongemi |
| **Status** | Merged (April 29, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @FrozenPandaz
> Suggested changing description from "The Gradlew executor is used to run Gradle tasks" to "The Gradle executor is used to run Gradle tasks" for accuracy.

### @FrozenPandaz
> can we use the pseudo terminal for this? — regarding the batch runner execution approach using `execSync`.

### @FrozenPandaz
> Recommended updating the executor description to "Runs gradle tasks via the Gradle Tooling API or by invoking gradlew" to better reflect dual functionality.

### @FrozenPandaz
> Requested changes on multiple files including build configuration and Kotlin implementation details during initial review phase.

### @FrozenPandaz
> Approved final changes after xiongemi addressed PR comments in the fix commit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
