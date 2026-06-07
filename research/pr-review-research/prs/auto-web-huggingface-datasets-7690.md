# huggingface/datasets #7690 — HDF5 support

**[View PR on GitHub](https://github.com/huggingface/datasets/pull/7690)**

| | |
|---|---|
| **Author** | @klamike |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lhoestq
> maybe it should create nested features like this instead? Features({ "position": { "x": List(Value("int64")), "y": List(Value("int64")), }, ...})

### @lhoestq
> Looks good ! btw with `ds = ds.flatten()` you can get a flat structure with columns named `"position.x"`, `"position.y"` etc.

### @lhoestq
> This is great ! I left a few comments :) Btw feel free to run `make style` to fix code formatting

### @klamike
> does [commit] look good? I'm not sure it will be as fast as the separate columns but it does clean up the collision checks.

### @lhoestq
> Yay ! LGTM :) Let's document this now, this is big ! Would you like to to open a PR for the docs ?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
