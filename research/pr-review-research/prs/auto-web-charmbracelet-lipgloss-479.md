# charmbracelet/lipgloss #479 — feat(table): improve sizing and behavior: wrap by default, overflow optionally

**[View PR on GitHub](https://github.com/charmbracelet/lipgloss/pull/479)**

| | |
|---|---|
| **Author** | @andreynering |
| **Status** | Merged (March 12, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bashbunni
> Note: this feature should not be merged until charmbracelet/x#350 is merged and released as the new `cellbuf.Wrap` allows us to have clean wrapping of pre-defined styles in tables.

### @bashbunni
> docs(table): simplify Wrap example + fix name for godoc support

### @aymanbagabas
> (Flagged a dependency management issue: concerns about the `charmbracelet/x/cellbuf` dependency version in go.mod requiring resolution before merging.)

### @bashbunni
> (Multiple comments requesting tests for "wrapping cell styles" and "truncation logic for overflow and nowrap" to ensure edge cases were properly validated.)

### @caarlos0
> can you put some screenshots of before/after?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
