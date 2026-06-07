# k3s-io/k3s #10973 — Auto import images for containerd image store

**[View PR on GitHub](https://github.com/k3s-io/k3s/pull/10973)**

| | |
|---|---|
| **Author** | @vitorsavian |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @brandond
> To avoid confusion, remove any references to importing things into the embedded registry - the embedded registry does not have a discrete image store to import into.

### @brandond
> What happens if the user makes the images dir a symlink to another path? What happens if the image dir is deleted and recreated while the watcher is going?

### @brandond
> Why are we creating this now? Must the folder exist in order to watch it? Is there any other way to handle this?

### @brandond
> it would be nice if whatever we used for watching image file changes was generic, and could be reused by the deploy controller

### @harsimranmaan
> This is an improvement to the existing mechanism of importing images via the existing agent/images folder. Prior to this change, you could specify the image tar or image list only at k3s boot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
