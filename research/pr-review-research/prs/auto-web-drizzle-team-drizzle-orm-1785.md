# drizzle-team/drizzle-orm #1785 — Fix: json and jsonb parsing in postgres-js

**[View PR on GitHub](https://github.com/drizzle-team/drizzle-orm/pull/1785)**

| | |
|---|---|
| **Author** | @Angelelz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aseemk
> when this is fixed, will there be any easy way to migrate all existing data/columns we persisted through Drizzle that was incorrectly persisted as JSON strings instead of JSON objects directly?

### @AndriiSherman
> Before merging this one we will think this through. I guess we will write a small guide on how you can migrate this data to be a proper JSON

### @hawkett
> Is this fix waiting on a migration path for existing jsonb data? If so, would it be possible to decouple these problems so it could be released?

### @Hansenq
> I didn't really see a big difference between Postgres.js and node-postgres (pg), so I switched to node-postgres which doesn't have this issue...The only downside is that you'll have to write a data migration that translates the old escaped JSON values into the new ones yourself.

### @arjunyel
> Provided a patch-package workaround showing the specific serializer types ('114' and '3802') needing fixes in the postgres-js driver

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
