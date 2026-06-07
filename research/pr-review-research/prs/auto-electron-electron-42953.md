# electron/electron #42953 — feat: GPU shared texture offscreen rendering

**[View PR on GitHub](https://github.com/electron/electron/pull/42953)**

| | |
|---|---|
| **Author** | @reitowo |
| **Status** | ✅ merged |
| **Opened** | 2024-07-18 |
| **Repo importance** | ★121,543 · 17,236 forks · score 195,486 |
| **Diff** | +1010 / −103 across 34 files |
| **Engagement** | 34 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @reitowo — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2305977083)

> Great!
> 
> Thanks for all your work reviewing this PR and maintaining electron. I'm glad to be able to make this contribution! ❤️

### @reitowo — 2 reactions  
`👍 2`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2235721789)

> Well, it seems the CI machine failed to create a D3D11 device.
> 
> ![image](https://github.com/user-attachments/assets/2bcad181-c766-4234-b3f2-8606b54789ec)
> 
> Trying to make this optional.

### @itsananderson — 2 reactions  
`👍 2`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2265990532)

> If someone enables this feature, but neglects to call `texture.release()`, it sounds like that could cause a memory leak. Would it be possible to monitor for when the JS `texture` object is getting GC'd and either release the shared texture automatically (if that is safe to do), or print a warning so that the developer can detect that they're leaking memory?
> 
> There is an [EmitWarning ](https://github.com/electron/electron/blob/main/shell/common/process_util.cc#L16-L28) function that you could use to log this warning. You'd also only want to log it once per process lifetime, to avoid spamming for every `paint` event.

### @reitowo — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2294894918)

> @erickzhao @ckerr Guys, could you please recheck this and approve once you got time, thanks!
> 
> @jkleinsc It is necessary for you to approve the changes to unblock the requested changes? Seems still requring changes. I'm unsure about that, just to make sure.
> 
> Sorry for pinning!

### @ckerr — 1 reactions  
`🎉 1`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2305957562)

> merging this at last: everything is green and this has four approvals :tada: 
> 
> @reitowo it's uncommon for the project to get fully-formed PRs like this one. Don't be a stranger.

### @erickzhao — 1 reactions  
`🎉 1`  ·  [link](https://github.com/electron/electron/pull/42953#issuecomment-2344320124)

> Hi @reitowo,
> 
> If you would like to backport the PR to previous branches, a releaser can assist by running Trop automation. Backporting a feature PR will automatically put it up for a vote by the Releases working group, whereafter the PR can be accepted or denied on a case-by-case basis.
> 
> See https://www.electronjs.org/docs/latest/tutorial/electron-versioning#backport-request-process for more info.
> 
> As an aside (I'm not in the WG), I think the general policy for stable release lines is that PRs with large patches or changes to existing code paths are considered riskier and have a lower chance of being accepted.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
