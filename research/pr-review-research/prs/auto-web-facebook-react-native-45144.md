# facebook/react-native #45144 — [LOCAL][Release-Testing] Update the testing script to use the new template

**[View PR on GitHub](https://github.com/facebook/react-native/pull/45144)**

| | |
|---|---|
| **Author** | @cipolleschi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cortinico
> Can we keep the cleanup?

### @cipolleschi
> this folder does not exists anymore. it was pointing to /tmp/template which was the folder where we were cloning the template. We are not cloning the template anymore, so the folder is gone

### @blakef
> This shouldn't be a `file://` dependency, just the version so it uses Verdaccio.

### @cipolleschi
> we want to use the exact same version we built in CI, so we download react native and we use the local file. Having it to point to the locally published package means that we are going to rebuild react native locally

### @cortinico
> Note: this won't work for `rc.0` the next time... I think the most correct way to do would be to: git clone the template [and] git checkout to the `0.75-stable` branch

### @cipolleschi
> the current approach doesn't work to test older versions of react native. But also the steps highlighted here don't work, unless we have a release branch for the template as well.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
