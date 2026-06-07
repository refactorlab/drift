# mastodon/mastodon #31529 — Implement Instance Moderation Notes

**[View PR on GitHub](https://github.com/mastodon/mastodon/pull/31529)**

| | |
|---|---|
| **Author** | @ThisIsMissEm |
| **Status** | ✅ merged |
| **Opened** | 2024-08-21 |
| **Repo importance** | ★49,999 · 7,456 forks · score 84,810 |
| **Diff** | +294 / −14 across 20 files |
| **Engagement** | 21 conversation · 72 inline review comments |

## Top review comments (ranked by reactions)

### @ThisIsMissEm — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-3000740011)

> > > We reuse the report_notes/report_notes partial in this feature — we should probably rename that partial to moderation_notes or something, since it is used for Account Moderation Notes, Report Notes, and Instance Notes.
> > 
> > Yes! And maybe put that in either `app/views/shared/` or `app/views/admin/shared/` (the latter does not yet exist, but would make sense here).
> 
> I'll do a follow up PR for doing this, since it's quite a large change to implement (many unrelated files)

### @ThisIsMissEm — 1 reactions  
`👀 1`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-3000825653)

> Rebased against main and it dropped the reviews..

### @ThisIsMissEm — 0 reactions  
`—`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-2481539118)

> Okay, update time:
> 
> For an instance that is "known" with moderation notes by multiple authors:
> ![image](https://github.com/user-attachments/assets/e97340fa-fc92-4598-b93f-a330c7ad6c0b)
> 
> For a known instance without any moderation notes:
> 
> ![image](https://github.com/user-attachments/assets/464cf13d-c9ad-4c19-b58b-44dcadf52f98)
> 
> For an instance that is "unknown", I've allowed moderation notes to be left
> 
> However it's not currently possible to find instances with moderation notes that are not "known" again through the instances list view. I did try updating the scenic view but hit into an issue due to the union and duplicate keys in the unique index on domain. We probably need to rework that view if we want instances with notes to be findable via the instances list page.
> 
> ![image](https://github.com/user-attachments/assets/2cac2c2c-4392-421d-b6aa-07e1ab257ad9)
> 
> And the error state for the form:
> 
> ![image](https://github.com/user-attachments/assets/be035461-622a-4cc6-b3f8-51463b936372)
> 
> We could also add in the max-length to the moderation note textarea placeholder.

### @ThisIsMissEm — 0 reactions  
`—`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-2764220806)

> Me: why are the tests failing? There's only one delete button.. 
> 
> Me: *\*looks at the account moderation notes\** oh.
> 
> <img width="1218" alt="Screenshot 2025-03-29 at 20 52 47" src="https://github.com/user-attachments/assets/15d976d5-af7b-48ee-a3f5-1a6d7e4c8e51" />
> 
> (this is fixed, but lol)

### @ClearlyClaire — 0 reactions  
`—`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-2963002333)

> > However it's not currently possible to find instances with moderation notes that are not "known" again through the instances list view. I did try updating the scenic view but hit into an issue due to the union and duplicate keys in the unique index on domain. We probably need to rework that view if we want instances with notes to be findable via the instances list page.
> 
> Given this is not a fully-working situation, I would just *not* handle unknown servers for now, in order to reach a significantly simpler PR. This can be implemented afterwards.

### @ThisIsMissEm — 0 reactions  
`—`  ·  [link](https://github.com/mastodon/mastodon/pull/31529#issuecomment-2963091510)

> > > However it's not currently possible to find instances with moderation notes that are not "known" again through the instances list view. I did try updating the scenic view but hit into an issue due to the union and duplicate keys in the unique index on domain. We probably need to rework that view if we want instances with notes to be findable via the instances list page.
> > 
> > Given this is not a fully-working situation, I would just _not_ handle unknown servers for now, in order to reach a significantly simpler PR. This can be implemented afterwards.
> 
> @ClearlyClaire You can always go back to them via direct URL, which is how you'd probably reach them in the first place. So I'd consider any view changes out of scope for this PR


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
