# eslint/eslint #18134 — feat: Add support for TS config files

**[View PR on GitHub](https://github.com/eslint/eslint/pull/18134)**

| | |
|---|---|
| **Author** | @aryaemami59 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cany748
> Wouldn't it be better to use Jiti for this? I think it's perfect for this, it's used in Nuxt and TailwindCSS to load configuration from Typescript files. It is much smaller and faster than Typescript.

### @aladdin-add
> the first-class ts config support has been discussed in #12078 eslint/rfcs#50, and seems we didn't come to an agreement to accept it.

### @aladdin-add
> it should be possible to use ts config in the current config. The easiest way I can think of is to use `--config` and `--loader`

### @aryaemami59
> That still won't work with `.mts` or `.cts` extensions, it also doesn't respect the `type` field in `package.json`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
