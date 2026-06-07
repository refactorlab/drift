# tikv/tikv #17625 — raftstore: `campaign` newly created regions in time after `Split`

**[View PR on GitHub](https://github.com/tikv/tikv/pull/17625)**

| | |
|---|---|
| **Author** | @LykxSassinator |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SpadeA-Tang
> For this, why not just change the compaign condition from leader to leader/candidate?

### @glorv
> there are 2 ways that a follower can become candidate: 1) transfer leader, 2) election timeout. So if the following became candidate due to election timeout and also apply split at the same time, the new created region should not start a election

### @overvenus
> It's not enough, peer 2 may already split before it receives MsgTimeoutNow.

### @LykxSassinator
> we want to make 'TransferLeader' and other operations which changes the `conf_ver` mutually exclusive ... avoiding unexpected behaviors that we do not observe right now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
