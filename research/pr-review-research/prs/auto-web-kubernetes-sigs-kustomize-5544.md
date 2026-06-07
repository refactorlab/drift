# kubernetes-sigs/kustomize #5544 — Run kustomize build with kustomize localize and add a no-verify flag

**[View PR on GitHub](https://github.com/kubernetes-sigs/kustomize/pull/5544)**

| | |
|---|---|
| **Author** | @sanaasy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stormqueen1990
> I have some concerns with the `exec.Command()` approach. Specifically, this approach requires the executable to be present in `$PATH`, and because it shells out to a separate command, it might be running `build` in a version that yields a result different from what the caller would yield.

### @stormqueen1990
> With regards to using `exec.Command`, I am not sure if I understand the reasoning for choosing it over invoking the `build` command function directly, since `localize` and `build` are relatively co-located in the codebase.

### @varshaprasad96
> Curious: Is it intentional to add this log statement and explicitly mention the diff?

### @sanaasy
> I chose to exec this way to remove the dependency on building the command itself in the localize file and executing the Run command. If this is the preferred method though, I am happy to change it!

### @sanaasy
> The command indicates success if the outputs match and throws an error with a diff summary otherwise.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
