# spf13/cobra #2231 — feat: add CompletionWithDesc helper

**[View PR on GitHub](https://github.com/spf13/cobra/pull/2231)**

| | |
|---|---|
| **Author** | @ccoVeille |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @marckhouzam
> My only hesitation about making this change is that programs that want to use the new type alias will need to replace `[]string` with `[]cobra.CompletionChoice` which is long.

### @marckhouzam
> OK for cobra.Completion. As for CompletionWithDescription, since that's a function, I'm not as concerned. But I've used 'Desc' multiple times before in cobra, so let's go with 'CompletionWithDesc'

### @marckhouzam
> I tried this with `tanzu` and I like the way it looks; it makes the code much clearer. I went ahead and used your new `Completion` and `CompletionWithDesc` in the rest of the Cobra code base.

### @marckhouzam
> The problem happens because now we are asking go to accept the type `ValidArgsFn` (of the docker CLI) as the type `cobra.CompletionFunc`, which, although they are the same, is understandably not a valid conversion.

### @thaJeztah
> I did a quick test, and it _seems_ that making the `ValidArgsFn` on our side an alias, so not a distinct type, works; even when the signature keeps `[]string`.

### @ccoVeille
> I think the issue is in fact related to #2220 where CompletionFunc was added. The changes in the current PR and #2220 were released at same time.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
