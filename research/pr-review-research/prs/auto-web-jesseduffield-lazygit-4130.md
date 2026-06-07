# jesseduffield/lazygit #4130 — Add ability to configure branch color patterns using regex

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/4130)**

| | |
|---|---|
| **Author** | @mtrajano |
| **Status** | Merged (January 12, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stefanhaller
> If we want to do pattern matching with wildcards in this way, we should use the `Glob` package to support the full globbing syntax. However, I'm unsure if globbing is the best solution here. I'd rather thought we'd use regular expressions; they are more powerful and flexible.

### @stefanhaller
> How do you feel about removing this default behavior? I find it surprising and annoying...if I want to use the new regex patterns now, I have to explicitly disable the defaults, which is very non-obvious.

### @jesseduffield
> Those feature/bugfix/hotfix things are based on 'gitflow' which is now considered legacy by many, so I'm happy to remove those defaults.

### @jesseduffield
> I'm suggesting we change the name in our code...to serve as a reminder for the maintainers in the future when deprecating configuration fields.

### @stefanhaller
> One thing I'm wondering is whether we should explicitly mention that the regex patterns are not anchored, and that users need to do that themselves if they want an exact match.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
