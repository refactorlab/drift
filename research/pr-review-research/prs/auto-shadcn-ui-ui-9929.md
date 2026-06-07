# shadcn-ui/ui #9929 — Add fontsource and support override for registry:font install

**[View PR on GitHub](https://github.com/shadcn-ui/ui/pull/9929)**

| | |
|---|---|
| **Author** | @kapishdima |
| **Status** | ✅ merged |
| **Opened** | 2026-03-09 |
| **Repo importance** | ★115,750 · 8,990 forks · score 156,694 |
| **Diff** | +800 / −346 across 189 files |
| **Engagement** | 19 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @shadcn — 1 reactions  
`👍 1`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4023136765)

> Let me take a look. I'll come up with a solution.

### @shadcn — 1 reactions  
`👍 1`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4060625080)

> Yes. That's right. The dependency field gives you explicit control here. Set family to match whatever package you're using:
> 
> - "family": "'Fira Code Variable', monospace" with "dependency": "@fontsource-variable/fira-code"
> - "family": "'Fira Code', monospace" with "dependency": "@fontsource/fira-code"
> 
> It should be deterministic. The CLI shouldn't transform or guess font names. We leave that to the registry author.

### @kapishdima — 0 reactions  
`—`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4022912414)

> @shadcn , I also have this issue in Fonttrio
> 
> <img width="1660" height="910" alt="image" src="https://github.com/user-attachments/assets/1ae023b2-3609-42d8-b37a-0cb24129972f" />
> 
>  I’m thinking - what if I make the installation use only fontsource (non-variable fonts)? That should be more stable
> 
> Of course, I could add a check for whether the font exists in fontsource/variable, but it feels like that would increase the cognitive load in the code 🙃

### @shadcn — 0 reactions  
`—`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4031453781)

> I'm checking if the following would be better: a `dependency` field.
> 
> ```json
> {
>   "name": "font-inter",
>   "type": "registry:font",
>   "font": {
>     "family": "'Inter Variable', sans-serif",
>     "provider": "google",
>     "import": "Inter",
>     "variable": "--font-sans",
>     "dependency": "@fontsource-variable/inter" // ←
>   }
> }
> ```
> 
> ```json
> {
>   "name": "font-lato",
>   "type": "registry:font",
>   "font": {
>     "family": "'Lato', sans-serif",
>     "provider": "google",
>     "import": "Lato",
>     "variable": "--font-sans",
>     "weight": ["400", "700"],
>     "dependency": "@fontsource/lato" // ←
>   }
> }
> ```

### @kapishdima — 0 reactions  
`—`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4031482192)

> @shadcn Hmm, but what if the user has only **`fontsource/variable`** specified in `dependency`, and the font is installed only from there — but the browser **doesn’t support variable fonts**? Then a fallback would have to be added manually.
> 
> My **PR** does a few things:
> 
> * Installs both **`fontsource`** and **`fontsource/variable`**
> * Adds a **`@supports` block in CSS** so both variants are supported
> * Fixes the issue in **non-Next.js projects** where the `font-family` is used **without the `Variable` suffix**, while `fontsource/variable` imports it **with** the suffix.
> 
> For example, `fontsource/variable` exports **"Fira Code Variable"**, but the CSS currently uses just **"Fira Code"**.

### @kapishdima — 0 reactions  
`—`  ·  [link](https://github.com/shadcn-ui/ui/pull/9929#issuecomment-4031531181)

> @shadcn , I thought a lot about something like this. Then registry authors wouldn’t need to worry about whether a font is supported in fontsource:
> ```js
> // ...
> const response = await fetch(`https://registry.npmjs.org/@fontsource-variable/{fontName}`);
> 
> if(response.ok) {
> 	tree.css[`@import "${fontSourceVariable}"`] = {}
> }
> // ...
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
