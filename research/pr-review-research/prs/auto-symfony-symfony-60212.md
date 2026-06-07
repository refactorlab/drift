# symfony/symfony #60212 — [Form] Add `FormFlow` for multistep forms management

**[View PR on GitHub](https://github.com/symfony/symfony/pull/60212)**

| | |
|---|---|
| **Author** | @yceruto |
| **Status** | ✅ merged |
| **Opened** | 2025-04-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +3541 / −2 across 49 files |
| **Engagement** | 46 conversation · 48 inline review comments |

## Top review comments (ranked by reactions)

### @yceruto — 10 reactions  
`❤️ 10`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-2954088635)

> I’ve also identified another use case for this feature: when dealing with a configuration settings panel containing multiple forms or fields, logically grouped into tabs without a strict order or interdependency, you can leverage FormFlow to split the large form into sections/tabs.
> 
> For instance: Profile | Password | Team | Notification | etc. and all of which belong to a single `Account` entity. In this case, instead of creating separate controllers and routes for each section, you can define a single controller and route e.g. `/account/settings` to handle them all, using multiple "step" forms that can be customized and accessed independently, without enforcing any specific flow order.
> 
> ![settings-sample](https://github.com/user-attachments/assets/876a13c1-b4df-44c7-86af-86be5ce014d2)

### @chalasr — 7 reactions  
`👍 7`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-3406617027)

> I like `Flow` instead of `MultiStep`. Even if it's less common, it's a cool name that does convey the feature's purpose. The fact it's a subset of the Form component and not a component on its own makes it even more OK. Also the `Step` term appears everywhere in the public API which removes the potential obscurity.

### @yceruto — 5 reactions  
`👍 4 · 👀 1`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-2954070041)

> @Lorenzschaef Absolutely possible!
> 
> I will be sharing a demo project with several examples very soon:
>  * Basic multistep form
>  * Advanced multistep form
>     * Custom form themes
>     * Skip steps dynamically based on previous choices
>     * Navigate to any previous step
>     * Dynamic steps definition
>     * Custom Flow Buttons
>        * Managing input collections (CollectionType without JS)
>        * Skip step on user demand
>        * File uploading

### @RafaelKr — 5 reactions  
`👍 5`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-3172570159)

> I also like the short but precise terminology "Flow" and as long as we can find it inside the documentation with those "synonyms" (Multi Step Form, Form Wizard, etc.) I think we're good :)
> 
> And if those synonyms are also mentioned inside a PHPDoc comment and/or the test cases it's also searchable inside the code-base.

### @yceruto — 4 reactions  
`🎉 4`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-2801402805)

> >how can I jump back to a specific step without having to press the back button many times?
> 
> Hey! take a look at the `testMoveBackToStep()` test, it covers this case. It's possible via submit operation or manually using `$flow->movePrevious('step')` directly.

### @yceruto — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/symfony/symfony/pull/60212#issuecomment-2973172211)

> As promised, here’s the demo app: https://github.com/yceruto/formflow-demo.
> 
> I’d love to see what other use cases you think this feature could support, feel free to share your ideas!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
