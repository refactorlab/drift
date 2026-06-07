# facebook/docusaurus #10137 — feat(docs, blog): add support for `tags.yml`, predefined list of tags

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/10137)**

| | |
|---|---|
| **Author** | @OzakIOne |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @slorber
> We need : export type VersionMetadata = ContentPaths & { tagsFile: TagsFile | null; tagsPath: string; }

### @slorber
> We probably need to modify/rename this method type TagsFile = Record<string, Tag>

### @slorber
> (Multiple inline comments requesting changes to function signatures and type definitions across options.ts, plugin-content-docs.d.ts, tags.ts, docs.ts, and docusaurus.config.ts files.)

*Note: The PR conversation page experienced multiple GitHub rendering errors ("Uh oh! There was an error while loading") that obscured the verbatim text of several additional inline review comments.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
