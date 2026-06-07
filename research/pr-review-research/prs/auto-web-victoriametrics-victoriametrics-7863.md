# VictoriaMetrics/VictoriaMetrics #7863 — issue-7717: implement migration from mimir object storage

**[View PR on GitHub](https://github.com/VictoriaMetrics/VictoriaMetrics/pull/7863)**

| | |
|---|---|
| **Author** | @dmitryk-dk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zekker6
> It would be great to also update vmctl docs to show a few examples of migrating data from Mimir. The doc should also include a note about the resource usage and sequence of steps which are performed during migration.

### @philk
> this is extremely memory intensive and at a quick skim into the code it looks like it's not streaming the chunks to disk but reading them all into memory at once.

### @philk
> I'm not sure there's a good solution to the `00:00:00` issue (maybe just document the caveat). Even if you kind of flipped it around you'd have the reverse problem.

### @f41gh7
> The only problem I see is concurrent access to the mimir data directory. Mimir process must stop any writes to correctly perform migration.

### @f41gh7
> Looks like it's not properly releases memory and slow in general. It will require some time to polish it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
