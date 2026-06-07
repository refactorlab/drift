# appwrite/appwrite #8378 — Development Keys

**[View PR on GitHub](https://github.com/appwrite/appwrite/pull/8378)**

| | |
|---|---|
| **Author** | @lohanidamodar |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Meldiron
> Last few comments, but everything else looks good to me.

### @TorstenDittmann
> I am a bit worried about the changes to the test suite, feels like the changes don't really scale? lets say we have a second test suite that needs similiar changes, we shouldnt just add more exlusions/inclusions

### @ChiragAgg5k
> i think this was a one off case where the the rest of the tests are designed with `ABUSE=disabled` in mind but here we specifically wanted `ABUSE=enabled`. I think we can better improve the CI code, making it more concise, but i dont necessarily see a problem with exclusions and inclusions

### @Meldiron
> Last few comments, but everything else looks good to me.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
