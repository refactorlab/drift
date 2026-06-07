# strapi/strapi #24246 — Feat: persistent list view settings

**[View PR on GitHub](https://github.com/strapi/strapi/pull/24246)**

| | |
|---|---|
| **Author** | @mvo-zyres |
| **Status** | ✅ merged |
| **Opened** | 2025-08-26 |
| **Repo importance** | ★72,316 · 9,752 forks · score 116,323 |
| **Diff** | +308 / −69 across 8 files |
| **Engagement** | 45 conversation · 20 inline review comments |

## Top review comments (ranked by reactions)

### @Adzouz — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3334490059)

> Hey there! Thanks a lot for the proposal 🙏 And also, very sorry for the late answer.
> We needed to discuss with the team. We were thinking if it would rather be better to store this info directly in the DB to be able to persist the config to a user and not only a device.
> But since it would be another kind of complexity, we agreed to move forward with this solution that would help the UX 😊
> I'll run some tests and review it asap and let you know!

### @zy-merch — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3334552770)

> Hello @Adzouz, thanks for the reply! Let us know if anything comes up during the tests and review.

### @mvo-zyres — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3370539214)

> Hey @Adzouz, 
> 
> thanks for your response.
> 
> I could indeed see the issue. We actually had that issue at some point as I thought it was fixed. Turns out it was not :)
> 
> It should be fixed by updating the usePersistentState hook to reinitialize the state on key change. 
> The issue was, that the state was still used from the last model. So each time you change the model/collection-type it would apply the display headers from the previous one and save them also to the local storage of the current one.
> 
> The usePersistentState as i know is also used in other places apart from the display headers. Though the changes i made should not cause any other issues, it should still be reviewed if this is actually the way to go or if we need a better solution.
> 
> Let be know if it now also works on your local!

### @mvo-zyres — 1 reactions  
`🚀 1`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3376710672)

> @Adzouz Yes that is possible. Whenever you change the display headers now (or on initial loading from local storage) they will be checked against the attributes in the schema to remove any non-existent attributes from the display headers.

### @mvo-zyres — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3400808017)

> Hey @Adzouz dont worry 😅
> I just applied all the changes and i also removed the  `import { parse, stringify } from 'qs';` because it was also unused after removing the getPluginsParamsForLink method. 
> 
> Hope its now ready for a release (when the tests pass) :pray:

### @HichamELBSI — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/strapi/strapi/pull/24246#issuecomment-3547281710)

> > Hey @mvo-zyres yes I think that would be a good idea! In order to make it consistent. Today, if we switch to another locale and click on another content-type, it's keeping the chosen locale and pass it through a URL parameter but I guess we could do that through the local storage. The only concern I have is that we need to check that it's still possible to override the element through the URL params. We need to make sure that even if the local storage can't store it, it's still possible to switch from a locale to another. What's your opinion @HichamELBSI?
> 
> Definitely, let's do that 👍🏽


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
