# facebook/react-native #42943 — fix: fix codegen not finding all third-party libraries

**[View PR on GitHub](https://github.com/facebook/react-native/pull/42943)**

| | |
|---|---|
| **Author** | @tido64 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jbroma
> I've also found out that except for this, codegen has also issues with finding `codegen-enabled libraries` as the path where it looks for them is wrong when not using classic node_modules structure.

### @tido64
> With a pnpm setup (pnpm or Yarn + pnpm), all dependencies are always present under `node_modules`. In a hoisted setup (npm, Yarn), libs may not be found here.

### @NickGerleman
> Re structure, it seems like this is organized like a single app/library will depend on a single RN, then that RN dictates the association to version of codegen package?

### @dmytrorykun
> @tido64 it looks like these changes belong to this PR, yeah, let's include them.

### @tido64
> const configDir = baseCodegenConfigFileDir || process.cwd();

(Suggested a refined fix using `require.resolve` with proper error handling for dependency resolution.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
