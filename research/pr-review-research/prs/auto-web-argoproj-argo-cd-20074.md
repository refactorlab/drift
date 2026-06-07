# argoproj/argo-cd #20074 — feat(cli): Add Plugin Support to the Argo CD CLI

**[View PR on GitHub](https://github.com/argoproj/argo-cd/pull/20074)**

| | |
|---|---|
| **Author** | @nitishfy |
| **Status** | Merged (May 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @leoluz
> Please consider adding a new documentation page explaining how to write plugins and how to install and consume them.

### @leoluz
> we need to guarantee to plugin writers 2 capabilities: The plugin doesn't have to authenticate with Argo CD API...some global flags...makes sense to be available when executing plugins...it is not the plugin responsibility to handle those flags. We would need to pre-process the flags before invoking the plugin itself.

### @blakepettersson
> Could we not have a dummy (no-op) command for the error path?...parse the flags, specifically the flags we would like to still keep...and then we carry on with pluginHandler.HandleCommandExecutionError as before?

### @leoluz
Emphasized documenting current limitations clearly and marking the feature as alpha, noting that global flag parsing wasn't fully achievable due to Cobra's design constraints with unknown commands. He also raised security concerns, requesting review from the security SIG and noting potential risks requiring "a more security driven review."

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
