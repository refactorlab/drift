# rook/rook #14701 — rbdmirror: enable rbd rados namespace mirroring

**[View PR on GitHub](https://github.com/rook/rook/pull/14701)**

| | |
|---|---|
| **Author** | @parth-gr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BlaineEXE
> Is there an example we can give where the name needs to be set? For example, what if the namespace starts with `.`? Is that allowed?

### @parth-gr
> Yaa, I think this is the name to specify a special character name, as k8s doesn't support it but ceph supports

Note: This PR has a very large (196-comment) thread that GitHub renders lazily; only the above comments' prose was extractable from the rendered conversation/files HTML without an API token. Additional reviewers (travisn, Madhu-1, idryomov, rewantsoni) participated and approved, but their inline comment text was not reachable via the public HTML snapshot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
