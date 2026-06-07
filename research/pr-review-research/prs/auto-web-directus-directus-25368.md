# directus/directus #25368 — Add Services Type support for `@directus/extensions`

**[View PR on GitHub](https://github.com/directus/directus/pull/25368)**

| | |
|---|---|
| **Author** | @that1matt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @br41nslug
> If for any reason we cannot get the proper types for services then I think the already commented out stubs of `new (options: AbstractServiceOptions) => any` will work for now.

### @rijkvanzanten
> Is there a circular dependency between extensions and types maybe? That'd explain why it can't build them in order.

### @that1matt
> Had to go through the dependencies, and fix the circular dependency issues with `@directus/extensions` showing up in `@directus/types`, which was used in `@directus/extensions`.

### @br41nslug
> Still working on tests but pointed out some commented out services that we will need to include otherwise using these services will result in type errors.

### @coderabbitai
> Move `@directus/types` to `dependencies` (or declare it as a `peerDependency`). The `packages/errors/src/errors/range-not-satisfiable.ts` file imports the `Range` type from `@directus/types`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
