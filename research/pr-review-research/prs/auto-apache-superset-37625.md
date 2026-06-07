# apache/superset #37625 — chore(frontend): comprehensive TypeScript quality improvements

**[View PR on GitHub](https://github.com/apache/superset/pull/37625)**

| | |
|---|---|
| **Author** | @rusackas |
| **Status** | ✅ merged |
| **Opened** | 2026-02-03 |
| **Repo importance** | ★73,183 · 17,524 forks · score 148,279 |
| **Diff** | +14149 / −9969 across 441 files |
| **Engagement** | 24 conversation · 218 inline review comments |

## Top review comments (ranked by reactions)

### @rusackas — 2 reactions  
`🚀 1 · 😄 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3862603705)

> <img src="https://media4.giphy.com/media/v1.Y2lkPWJkM2VhNTdlMW5sOGx5aW55M3JwNTJ1Nm12OHphMzNydHM5aWlyZXQ5aGZnNTVvaSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/zCME2Cd20Czvy/giphy.gif"/>

### @EnxDev — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3846381059)

> Thanks a lot for this fantastic contribution! I’m really happy to see the migration progressing.
> I believe it would be useful to rely on this tracker, which I’ve updated multiple times (#18388)

### @EnxDev — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3849159343)

> > > Thanks a lot for this fantastic contribution! I’m really happy to see the migration progressing.
> > 
> > I believe it would be useful to rely on this tracker, which I’ve updated multiple times (https://github.com/apache/superset/discussions/18388)
> > 
> > 
> > 
> > @EnxDev I believe this covers _everything_ - the only JS files remaining are
> > 
> >   - /lib/ and /esm/ - Compiled build output (auto-generated from TS)
> > 
> >   - Config files - jest.config.js etc. (acceptable as JS)
> > 
> >   - generator-superset/generators/ - Yeoman generator templates - which we should deprecate anyway.
> 
> Yes, I’ve seen it. I still need to finish the review; there are a lot of files. Great job. I mainly mentioned it to officially mark the migration as complete, since it started years ago

### @rusackas — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3849205524)

> > I mainly mentioned it to officially mark the migration as complete, since it started years ago
> 
> @EnxDev exactly! This is my gigantic "let's never talk about it again" PR. I appreciate the review/engagement here... keep throwing stuff at me! If you're up for it, I'd even encourage you to check out the branch and hammer away at it. I take no special pride in doing it all solo... anyone is welcome to chip away on this thing with me!
> 
> Meanwhile, I'll keep rebasing, as conflicts are going to arise often. I'll probably also "squash" commits from time to time, when it spirals out of control. 
> 
> I replied to your comments thus far with new commits if you want to mark them as resolved. Keep 'em coming!

### @rusackas — 1 reactions  
`🎉 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3857132391)

> @EnxDev thanks for all the review comments... I applied/resolved the vast majority of them, but left a couple as TODO items for later. Happy to keep piling things on if you feel strongly about them at all, but I'm also happy whenever this PR turns green like it just did :)

### @rusackas — 1 reactions  
`😄 1`  ·  [link](https://github.com/apache/superset/pull/37625#issuecomment-3857135693)

> Come on AI bots, what else you got?
> 
> <img src="https://media3.giphy.com/media/v1.Y2lkPWJkM2VhNTdlNzVyanE2b2puNWhvdXpseGFxaW1vb3Z4d3p4bGkzdXpmenYwYnVvaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/sG4zmff2zDOp7t2MNA/giphy.gif"/>


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
