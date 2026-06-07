# zed-industries/zed #21675 — Add image dimension and file size information

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/21675)**

| | |
|---|---|
| **Author** | @kaf-lamed-beyt |
| **Status** | ✅ merged |
| **Opened** | 2024-12-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +312 / −10 across 10 files |
| **Engagement** | 65 conversation · 45 inline review comments |

## Top review comments (ranked by reactions)

### @Angelk90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2525061268)

> @kaf-lamed-beyt : 
> Great job, personally I would do this:
> 
> 1) I would remove the `Dimension:` and `Image size:`
> 2) I would show this information here below on the right at the beginning of these icons
> 
> <img width="230" alt="Screenshot 2024-12-07 alle 11 04 57" src="https://github.com/user-attachments/assets/51506445-0d28-471a-99ff-e1361db1044c">
> 
> You can take a screenshot of the image located at the following path: `./crates/zed/resources/app-icon-dev.png`
> 
> I don't understand why `webstorm` and `vscode` give two different weight dimensions.
> 
> Vscode:
> 
> <img width="1401" alt="Screenshot 2024-12-07 alle 11 09 44" src="https://github.com/user-attachments/assets/83bec8ba-1d56-4252-83a8-308242175600">
> 
> Webstorm:
> 
> <img width="1380" alt="Screenshot 2024-12-07 alle 11 10 13" src="https://github.com/user-attachments/assets/1723d427-7eda-4014-93cc-f75d9d8480ef">

### @mikayla-maki — 1 reactions  
`🚀 1`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2569951786)

> Awesome! I'll mark this as draft for now. Let me know when it's next ready for review :)

### @kaf-lamed-beyt — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2610115597)

> Yes. You're right. It is related to an image event not being called. Perhaps, I could try adding a new value `MetadataUpdated` or somn' in the `ImageItemEvent` enum. 
> 
> I'll try tinkering and let you know what I find.

### @kaf-lamed-beyt — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2631934583)

> CI is waiting for approval to run
> 
> cc: @mikayla-maki, @iamnbutler

### @kaf-lamed-beyt — 0 reactions  
`—`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2525068936)

> Alright! Thank you for the feedback @Angelk90. I'll take the screenshot and share it here. 
> 
> Quick question though... which crate would I need to update to show this image data in the location you asked me to move it? I'm thinking this one: `crates/zed/src/zed/app_menus.rs`?
> 
> Perhaps, using the `StatusItemView`?

### @kaf-lamed-beyt — 0 reactions  
`—`  ·  [link](https://github.com/zed-industries/zed/pull/21675#issuecomment-2525071218)

> Here's what i have
> 
> ![image](https://github.com/user-attachments/assets/a79d134c-fc73-4d11-9d7d-5cca75ef3a65)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
