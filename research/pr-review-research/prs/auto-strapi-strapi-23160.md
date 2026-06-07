# strapi/strapi #23160 —  Added firstPublishedAt field which sets the datetime when a content is first published. (#22512)

**[View PR on GitHub](https://github.com/strapi/strapi/pull/23160)**

| | |
|---|---|
| **Author** | @ankit7201 |
| **Status** | ✅ merged |
| **Opened** | 2025-03-15 |
| **Repo importance** | ★72,316 · 9,752 forks · score 116,323 |
| **Diff** | +157 / −3 across 8 files |
| **Engagement** | 53 conversation · 13 inline review comments |

## Top review comments (ranked by reactions)

### @innerdvations — 3 reactions  
`🚀 2 · 👀 1`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-3135693049)

> @pwizla This is finally ready to go. Could you add this to the documentation?
> 
> For some quick context so you don't have to read the whole thread:
> 
> - in config/features.js setting `future.experimental_firstPublishedAt:true` will add a new attribute to all content types with d&p enabled that will start recording the first time something was published, which will stay constant even if the article is unpublished 
> - This is an EXPERIMENTAL feature -- it should be noted that if the feature is ever disabled, you will lose the data in the firstPublishedAt field

### @pwizla — 3 reactions  
`🚀 3`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-3144856391)

> Perfect, I've just [documented](https://github.com/strapi/documentation/pull/2636) it, @innerdvations. Thank you!

### @yanniskadiri — 2 reactions  
`👍 2`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-2943464961)

> Hey @ankit7201 let's keep things simple for now: firstPublishedAt value remains the same, ie the date when a user first published the document
> 
> If there is feedback asking us to update the value, then we'll consider it

### @alexandrebodin — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-2736345174)

> > > that will set the value when enabling it
> > 
> > @alexandrebodin What will we set the value to when it is enabled for existing project?
> > 
> > One idea would be to set it same as publishedAt date but that would be inaccurate since a content might be published several times and thereby changing the published date and time when it was first published?
> 
> Yes it's the best we can do for existing data anyway

### @alexandrebodin — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-2736619552)

> > @alexandrebodin
> > 
> > Got it. Thank you for all the help.
> > 
> > Here is the final action plan:
> > 
> > 1. Add code to include firstPublishedAtField as part of the content-type schema json with default value as true anytime a new content type is created
> > 2. Add code to update the schema attribute to include firstPublishedAt field if it is enabled in the schema json (enabled by default)
> > 3. For existing apps, add DB migrations using publishedAt date as the value (similar to draftAndPublish)
> > 
> > For point 1, if possible, can you point me to some code sample where some schema options are being set when a new content type is created?
> 
> If you look in packages/core/content-type-builder/server/src/services/schema-builder/content-type-builder.ts you will see where we set the options that will be saved to file :)

### @ankit7201 — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/23160#issuecomment-2740512052)

> > In terms of the logic to set the value the default() { new Date() } won't be sufficient, it would add the date on the draft data. you will need more logic to be added in the document service.
> 
> @alexandrebodin 
> Got it. Thanks. 
> 
> I tried playing around with existing data and when firstPublishedAt was present for publishedData and not for draft data, publishing some new content was making firstPublishedAt field null. (Not sure why?)
> 
> Adding firstPublishedAt to draft data solved this problem. Will need to check why it was happening. Let me check in the code and try to understand what is going on. 
> 
> Thanks again.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
