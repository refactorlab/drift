# jupyterlab/jupyterlab #15948 — Much smaller "Last Modified" column, date

**[View PR on GitHub](https://github.com/jupyterlab/jupyterlab/pull/15948)**

| | |
|---|---|
| **Author** | @JasonWeill |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @krassowski
> I like the idea of having a shorter form _when needed_. I do not like forcing the shorter form and 'Mod' header by default.

### @jtpio
> Or at least configurable. For example Notebook 7 would likely keep the longer version by default.

### @krassowski
> Of note, this filebrowser is also used in Jupyter Notebook where it takes full-width of the page...the file selection dialog like `FileDialog.getOpenFiles` should probably always use the short form.

### @krassowski
> rendering the three variants will have three times the cost...I would strongly suggest to attempt to reimplement the conditional rendering on JS rather than CSS level.

### @jtpio
> Would it be possible to keep the original `Last Modified` here? Since the file browser is also used in Notebook, and there is plenty of space to display it.

### @andrii-i
> Shared macOS behavior showing timestamp format adjusted based on column width, suggesting a responsive approach to date display.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
