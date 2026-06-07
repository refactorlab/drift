# google/gvisor #11291 — Add a new RPC `ConnectWithCreds` to allow gofer to connect to a unix domain socket with application's credentials

**[View PR on GitHub](https://github.com/google/gvisor/pull/11291)**

| | |
|---|---|
| **Author** | @xianzhe-databricks |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ayushr2
> The gofer is running in a pivot_root(2) which only has the container filesystem...Note that the application in the container may not always be running with the UID from `spec.Process.User.UID`.

### @ayushr2
> setuid/setgid only changes the users/groups for the current system thread. So we need to use `runtime.LockOSThread()` and `runtime.UnlockOSThread()`

### @ayushr2
> Please squash all your commits into 1, because all commits from this branch will be applied directly to master if we were to merge this.

### @xianzhe-databricks
> We cannot rely on the uid/gid information passed from RPC message here, as what we did for the `mkdir` implementation...allowing connecting with arbitrary credential

### @avagin
> Review feedback on the implementation (several inline comments marked outdated in the conversation flow, indicating resolution through iterative changes).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
