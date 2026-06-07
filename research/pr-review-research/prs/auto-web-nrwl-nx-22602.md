# nrwl/nx #22602 — feat(core): add bun package manager

**[View PR on GitHub](https://github.com/nrwl/nx/pull/22602)**

| | |
|---|---|
| **Author** | @Jordan-Hall |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @meeroslav
> Since there doesn't seem to be a way to generate `bun.lockb` without running the install, I would use the `stringifyYarnLockfile` to be as close as possible to the intended package versions.

### @jaysoo
> We should reuse `stringifyYarnLockfile` to parse the file, as long as it handles bun-specific strings: `# bun` at the top, and `version "workspace:<proj>"`

### @JamesHenry
> Thanks a lot for this @Jordan-Hall! We will need some e2e coverage in addition to the comments

### @jaysoo
> We'll need a follow-up to make sure that `--generatePackageJson` for executors won't error out due to missing lockfiles. For Bun, we'll skip the lockfile for now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
