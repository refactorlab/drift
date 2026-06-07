# pytorch/pytorch #158613 — Setup TorchBench in Docker

**[View PR on GitHub](https://github.com/pytorch/pytorch/pull/158613)**

| | |
|---|---|
| **Author** | @huydhn |
| **Status** | ✅ merged |
| **Opened** | 2025-07-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +41 / −48 across 9 files |
| **Engagement** | 23 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @huydhn — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3097659388)

> Confirmed:
> 
> * 1st run, cold Docker cache took half an hour in pull Docker image step https://github.com/pytorch/pytorch/actions/runs/16396172453/job/46329724191
> * 2nd run, warm Docker cache, same step took 8 minutes https://github.com/pytorch/pytorch/actions/runs/16396172453/job/46405894814

### @ZainRizvi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3100023071)

> @pytorchbot revert -c nosignal -m "Seems to have broken trunk. See [GH job link](https://github.com/pytorch/pytorch/actions/runs/16429779764/job/46430634676) [HUD commit link](https://hud.pytorch.org/pytorch/pytorch/commit/b3c868d603e8f7b6661c93cd3d50c9a7b213ad6c)"

### @XuehaiPan — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3125695250)

> @pytorchbot revert -c nosignal -m "checkout_install_torchbench function is removed but still referenced in trunk"
> 
> - https://github.com/pytorch/pytorch/actions/runs/16548440338
> https://github.com/pytorch/pytorch/blob/1cffb217ef521f6fb1d25b7a45085622eada5c2d/.ci/pytorch/macos-test.sh#L184

### @huydhn — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3086043340)

> Stack from [ghstack](https://github.com/ezyang/ghstack/tree/0.10.0) (oldest at bottom):
> * __->__ #158613

### @yangw-dev — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3090506125)

> FYI the error:
> 
> System.UnauthorizedAccessException: Access to the path '/home/grace/_work/_tool' is denied.  ---> System.IO.IOException: Permission denied    --- End of inner exception stack trace ---    at System.IO.FileSystem.CreateDirectory(String fullPath, UnixFileMode unixCreateMode)    at System.IO.Directory.CreateDirectory(String path)    at GitHub.Runner.Worker.JobRunner.RunAsync(AgentJobRequestMessage message, CancellationToken jobRequestCancellationToken)    at GitHub.Runner.Worker.JobRunner.RunAsync(AgentJobRequestMessage message, CancellationToken jobRequestCancellationToken)    at GitHub.Runner.Worker.Worker.RunAsync(String pipeIn, String pipeOut)    at GitHub.Runner.Worker.Program.MainAsync(IHostContext context, String[] args)
> --

### @huydhn — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/158613#issuecomment-3090520267)

> > FYI the error:
> > 
> > System.UnauthorizedAccessException: Access to the path '/home/grace/_work/_tool' is denied. ---> System.IO.IOException: Permission denied --- End of inner exception stack trace --- at System.IO.FileSystem.CreateDirectory(String fullPath, UnixFileMode unixCreateMode) at System.IO.Directory.CreateDirectory(String path) at GitHub.Runner.Worker.JobRunner.RunAsync(AgentJobRequestMessage message, CancellationToken jobRequestCancellationToken) at GitHub.Runner.Worker.JobRunner.RunAsync(AgentJobRequestMessage message, CancellationToken jobRequestCancellationToken) at GitHub.Runner.Worker.Worker.RunAsync(String pipeIn, String pipeOut) at GitHub.Runner.Worker.Program.MainAsync(IHostContext context, String[] args)
> 
> Yeah, this is an unrelated infra issue.  I was trying to fix these runners yesterday.  If I get it right, rerun would work now, so I will do that after the current jobs finish


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
