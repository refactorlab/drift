# huggingface/tokenizers #1970 — Fix node-release: all platforms, zig cross-compilation, universal macOS

**[View PR on GitHub](https://github.com/huggingface/tokenizers/pull/1970)**

| | |
|---|---|
| **Author** | @MayCXC |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @McPatate
> I think the version pinning to the commit hash is unnecessary

### @McPatate
> let's go with https://codeberg.org/mlugg/setup-zig@v2

### @McPatate
> 10.13 feels a bit old?

### @ArthurZucker
> do you have to use docker btw? / zig? I'd rather have it minimal still

### @Copilot
> --frozen-lockfile is a Yarn Classic flag and will fail. Use yarn install --immutable

### @Copilot
> build matrix still misses the armv7-linux-androideabi / tokenizers-android-arm-eabi target

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
