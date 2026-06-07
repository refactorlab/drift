# rustdesk/rustdesk #14671 — fix(ipc): harden local IPC authorization and portable-service bootstrap flow

**[View PR on GitHub](https://github.com/rustdesk/rustdesk/pull/14671)**

| | |
|---|---|
| **Author** | @fufesou |
| **Status** | ✅ merged |
| **Opened** | 2026-04-02 |
| **Repo importance** | ★115,597 · 17,458 forks · score 190,413 |
| **Diff** | +4497 / −246 across 13 files |
| **Engagement** | 64 conversation · 37 inline review comments |

## Top review comments (ranked by reactions)

### @rustdesk — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4315078529)

> # Review
> 
> The IPC hardening leaves root-to-user connection-manager paths unmigrated for key Linux/macOS service scenarios, causing the service to connect to the wrong per-UID socket directory. These are blocking regressions for installed remote-control flows.
> 
> ## Findings
> 
> ### [P1] Resolve the CM uid outside headless mode
> 
> File: `/Users/hzhou/rustdesk/src/server/connection.rs:4914-4919`
> 
> On Linux when the service process is root and the desktop is not headless, `user` stays `None`, but `run_as_user(..., None, ...)` still launches `--cm` as the active desktop user. With the paired hbb_common per-UID IPC paths, deriving `cm_uid` only from `user` means the retry loop falls back to `ipc::connect("_cm")` as uid 0 and never reaches `/tmp/{app}-{active_uid}/ipc_cm`, so normal installed-service sessions fail to attach to the connection manager.
> 
> ### [P1] Avoid UID-scoping macOS IPC before caller migration
> 
> File: `/Users/hzhou/rustdesk/libs/hbb_common/src/config.rs:849-853`
> 
> Including macOS in the new per-euid IPC parent path breaks existing root-to-user IPC flows: RustDesk's macOS service still launches `--cm` with `launchctl asuser <active uid>`, while its reconnects call `ipc::connect("_cm")` as root. After this change the service looks in `/tmp/{app}-0` and the CM listens in `/tmp/{app}-{active_uid}`, so installed macOS service sessions cannot connect to CM unless the macOS callers get a uid-targeted connect path too.

### @fufesou — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4317571998)

> https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4315078529
> 
> > [P1] Resolve the CM uid outside headless mode
> 
> Incorrect.
> 
> `--server` is run as the user process in non-headless mode.
> `--cm` is also run as the user process.
> 
> > [P1] Avoid UID-scoping macOS IPC before caller migration
> 
> Incorrect.
> 
> `--cm` is started by `--server`, not the "macOS service".
> 
> Both processes run in the user scope.

### @rustdesk — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4317946965)

> • The portable-service bootstrap path can reject valid SYSTEM children on common partial identity failures, and preexisting shmem parent directories bypass the intended ACL/reparse validation. These are
>   regressions in a security-critical startup path.
> 
>   Full review comments:
> 
>   - [P1] Treat partial identity failures as unavailable — /Users/hzhou/rustdesk/src/ipc/auth.rs:653-654
>     On Windows portable-service startup, ProcessIdToSessionId can succeed while is_process_running_as_system returns None (for example when OpenProcessToken on the SYSTEM child is denied). Because the
>     fallback only runs when the session id is also None, this path rejects the legitimate SYSTEM child before the ACL + one-time-token handshake, so portable service startup can fail on hardened/non-elevated
>     hosts.
>   - [P2] Validate preexisting shmem parent directories — /Users/hzhou/rustdesk/src/server/portable_service.rs:329-331
>     When the portable-service shmem directory already exists and the controller is not SYSTEM (normal before elevation), this condition skips set_path_permission_for_portable_service_shmem_dir, which is also
>     the only reparse/type/ACL validation for the parent. A local user can pre-create or leave ProgramData\...\portable_service_shmem with broad ACLs/a junction, causing the token-bearing shmem flink to be
>     created under an untrusted parent where another account can observe/delete it before the SYSTEM process opens it.

### @fufesou — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4318367258)

> https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4317946965
> 
> > [P1] Treat partial identity failures as unavailable
> 
> A better check is used now. And the comments are added.
> 
> > [P2] Validate preexisting shmem parent directories
> 
> Added.

### @21pages — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4366132130)

> Tested Windows portable/installed, Linux installed/AppImage/Flatpak, macOS portable/installed, and Android.
> 
>   Key observations:
>   - Linux installed switch-user behavior is better in this PR: each user has its own `--cm` process, so two `--cm` processes are observed. In release, `--cm` remains in the original process.
>   - macOS installed:
>     - Logout + switch user, reboot + login from lock screen, and lock screen without switching user work.
>     - Lock screen switch A -> B (both pr and nightly not work):
>       After switching to user B, there are two `--server`, and the screen randomly connects to either User A or User B. The mouse can click normally on the desktop. Connection may fail sometimes.

### @rustdesk — 0 reactions  
`—`  ·  [link](https://github.com/rustdesk/rustdesk/pull/14671#issuecomment-4394474753)

> • The patch still has regressions in the Windows portable-service startup hardening: unsafe preexisting shmem parents can be accepted, and in-progress elevated startups can be mistaken for stale and
>   restarted. These can break or weaken a security-critical bootstrap path.
> 
>   Full review comments:
> 
>   - [P2] Validate existing shmem parent ACLs — /Users/hzhou/rustdesk/src/server/portable_service.rs:336-336
>     When portable_service_shmem already exists and the controller is not SYSTEM, this path only checks that the directory is not a reparse point; it accepts whatever DACL was already there. If another local
>     account pre-creates this directory under the user-accessible app folder with broad inherited rights, the randomized shared-memory flink is created under a parent that other accounts can delete or replace
>     during SYSTEM bootstrap, causing the child to open a missing/untrusted shmem object. Existing parents should have the expected protected DACL or fail closed before use.
>   - [P2] Track elevated portable-service bootstrap stages — /Users/hzhou/rustdesk/src/server/portable_service.rs:850-851
>     This stale-start check only looks for a process whose first argument is --portable-service, but the bootstrap quickly hands off to --elevate and then --run-as-system while STARTING is still true. A
>     second elevation/start request during that window can reset STARTING, clear the shared memory/token, and launch another bootstrap, causing the original SYSTEM child to fail its handshake or multiple
>     starts to race. Please also recognize the propagated shmem/elevation stage … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
