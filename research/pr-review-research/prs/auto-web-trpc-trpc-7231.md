# trpc/trpc #7231 — feat: Support OpenAPI json generation for any tRPC appRouter

**[View PR on GitHub](https://github.com/trpc/trpc/pull/7231)**

| | |
|---|---|
| **Author** | @Nick-Lucas |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

The substantive review feedback came predominantly from the `coderabbitai` bot, which flagged real correctness, packaging, and consistency issues. They are quoted verbatim below.

### @coderabbitai
> The prerelease normalization currently captures only the channel name via `prereleaseMatch = version.match(/-(alpha|beta)(\b|$)/)` and rebuilds suffixedVersion as `${baseVersion}-${suffix}`, which strips numeric identifiers like .1 or .2

### @coderabbitai
> The simpleCases entry is defined as a plain object literal while other nested routers use `t.router(...)`, causing inconsistency; change the simpleCases declaration to use `t.router({...})`

### @coderabbitai
> In responseTransformer, avoid blanket any casts and calling `transformer.output.deserialize` on possibly undefined nested properties; narrow the top-level assertion once

### @coderabbitai
> The `postinstall`: 'pnpm run codegen' lifecycle should be removed from packages/openapi's package.json so consumers of the published tarball won't run a repo-only codegen step

### @coderabbitai
> The code currently deletes the existing SDK with `rmSync(outputDir, { recursive: true, force: true })` before awaiting `createClient(...)`, which risks leaving no SDK if generation fails

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
