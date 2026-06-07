# jupyterlab/jupyterlab #17986 — Debugger: display sources in main area widgets

**[View PR on GitHub](https://github.com/jupyterlab/jupyterlab/pull/17986)**

| | |
|---|---|
| **Author** | @HaudinFlorence |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @martinRenou
> Do we need this? We did not before.

### @martinRenou
> After some discussions with @JohanMabille, @afshin... We decided to get rid of the sources panel since: it takes up some space in the panel; it potentially duplicate information we already have on the screen; opening in the source in the main area makes the behavior closer to VSCode's debugger

### @krassowski
> It will close the preview even if I execute a cell in an unrelated notebook...After the first execution it will not close subsequently opened views which is inconsistent.

### @krassowski
> I opened #18682

### @SylvainCorlay
> I would really be in favor of moving forward with including @krassowski's work on path resolution...The need for something like this came up in several conversations recently.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
