# alacritty/alacritty #8434 — Add an option to drain child process output before termination

**[View PR on GitHub](https://github.com/alacritty/alacritty/pull/8434)**

| | |
|---|---|
| **Author** | @aborg-dev |
| **Status** | Merged (Jan 16, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kchibisov
> You'd need a changelog entry for the `alacritty_terminal` since it's a breaking change and bump a dev version in the `Cargo.toml` to the next one.

### @chrisduerr
> Requested changes to alacritty/src/cli.rs to ensure proper documentation of the new feature in command-line help text.

### @chrisduerr
> Flagged outdated comments in alacritty/src/event.rs requiring updates to reflect new drain behavior replacing old hold behavior.

### @aborg-dev
> During testing, author discovered the Quit action didn't work with hold enabled, requiring a fix to restore expected behavior parity with baseline.

> **Note:** Several inline review threads on this PR (30 comments) were marked resolved/outdated and collapsed by GitHub; their verbatim prose was not retrievable from the public HTML without a token. The above captures the web-visible substantive feedback.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
