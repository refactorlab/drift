# spf13/cobra #2238 — The default ShellCompDirective can be customized for a command and its subcommands

**[View PR on GitHub](https://github.com/spf13/cobra/pull/2238)**

| | |
|---|---|
| **Author** | @albers |
| **Status** | Merged (May 31, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ccoVeille
> We have an exported field with a pointer... the existing values they may want to pass are constants (with a iota btw) But then... You cannot pass a reference to a constant.

### @marckhouzam
> I assume you foresaw that and that's why you created the setter. I think that instead of using a pointer we could use the `shellCompDirectiveMaxValue` to indicate the value has not been set

### @marckhouzam
> Ahhh, my suggestion doesn't make sense because it's the compiler that sets the value of `DefaultShellCompDirective` to 0 for every command. That's why the pointer works because the compiler sets it to nil.

### @albers
> Well, we could add a `ToPointer` function for that purpose

### @marckhouzam
> your examples have convinced me that this is good enough. Let's go with it as is, if you can just fix the docs

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
