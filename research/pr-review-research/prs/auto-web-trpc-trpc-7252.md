# trpc/trpc #7252 — feat: Tanstack Intent Skills

**[View PR on GitHub](https://github.com/trpc/trpc/pull/7252)**

| | |
|---|---|
| **Author** | @Nick-Lucas |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

The substantive review feedback on this PR came predominantly from the `coderabbitai` bot, which flagged real correctness and teaching issues in the skill/example content. They are quoted verbatim below.

### @coderabbitai (on filename conventions)
> Rename this Markdown file to camelCase to match repo naming rules. SKILL.md does not follow the configured camelCase naming convention for .md files.

### @coderabbitai (on missing imports in examples)
> Missing `Document` type import in EJSON example. `Document` is used in `EJSON.deserialize(value as Document)` but not imported, so this snippet won't type-check.

### @coderabbitai (on broken CLI declarations)
> Verify the `intent` bin target is committed and publishable. This manifest now declares `intent: "./bin/intent.js"`. If the file is missing, the installed CLI entrypoint will be broken.

### @coderabbitai (on invalid React hooks patterns)
> Hooks example is invalid: `useTRPCClient()` is called inside an `async` function. This teaches a React-hooks-invalid pattern.

### @coderabbitai (on overpermissive route matching logic)
> `includes('public')` can misclassify non-public procedure paths and cause unintended caching. Use anchored prefix logic (e.g., `startsWith('public.')`)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
