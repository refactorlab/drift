# syncthing/syncthing #10421 — chore(etc): add comprehensive sandboxing

**[View PR on GitHub](https://github.com/syncthing/syncthing/pull/10421)**

| | |
|---|---|
| **Author** | @Valloric |
| **Status** | ✅ merged |
| **Opened** | 2025-10-08 |
| **Repo importance** | ★85,007 · 5,246 forks · score 110,985 |
| **Diff** | +190 / −6 across 1 files |
| **Engagement** | 30 conversation · 34 inline review comments |

## Top review comments (ranked by reactions)

### @GermanCoding — 2 reactions  
`👍 2`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-4027368277)

> Just an FYI that this PR was my "this change broke my workflow" moment (https://xkcd.com/1172/). "Silently" changing the umask wasn't that awesome for me. I relied on having some files world-readable on a folder so that folder had "ignore permissions" enabled in order for syncthing to rely on the umask (instead of whatever permissions the other side uses), but with this new default you can't even stat the dir if you're not the owner. For folders where permissions are synced the umask doesn't matter anyway, but this is a rather significant change in permissions for all folders where ignore permissions is set.
> 
> (systemd override obviously fixed it, just a surprising behaviour change given that this was released as a minor patch)

### @calmh — 2 reactions  
`👍 2`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-4038510293)

> It requires what it requires. These capabilities weren't default earlier either and just need the proper docs to enable.
> 
> > IMO it cannot be worth this level of access. WDYT?
> 
> I don't know what you're suggesting or implying here, but I suspect you need to chill. We're not going to remove features people are using just because you don't like the required capabilities.

### @Valloric — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-3446334823)

> I've made a small tweak to prevent a systemd warning about `io_uring_enter2` (code comments have details). I've also tightened the umask so it's `7027`, which now also prevents creation of files with `setuid/setgid` bits which are designed for privilege escalation. Such files are _incredibly_ dangerous.
> 
> @ProactiveServices Any further comments? 
> @calmh Any chance of this being merged in the foreseeable future? Or should I drop it?

### @Valloric — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-3884249351)

> @calmh Saw the merge, ty! 
> 
> If you could provide some info on where you'd like to see more documentation about the systemd unit, how to extend it with more security config and similar, I'd be happy to send a follow-up PR. 
> 
> Is there a particular docs page I should extend? A new one I should add? You likely have some ideas already and I'd love to hear them; this way we can avoid wasted work on both ends.

### @calmh — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-3884273083)

> I hadn't thought about it, but perhaps somewhere in the vicinity of https://docs.syncthing.net/users/autostart.html#using-systemd.
> 
> That page is a bit windows-heavy though and it's hard to even find the systemd part, I just knew it was in there somewhere. Possibly it could be reorganised better.

### @Valloric — 1 reactions  
`👎 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10421#issuecomment-4030239670)

> @GermanCoding I'm sorry this change affected your workflow, but a world-readable umask for a folder containing unknown PII  is not a safe default. If you need it, you should set it explicitly in a systemd unit override (as you've discovered).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
