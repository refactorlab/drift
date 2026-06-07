# twbs/bootstrap #42165 — Refine Stepper component

**[View PR on GitHub](https://github.com/twbs/bootstrap/pull/42165)**

| | |
|---|---|
| **Author** | @pricop |
| **Status** | ✅ merged |
| **Opened** | 2026-03-13 |
| **Repo importance** | ★174,302 · 78,852 forks · score 494,709 |
| **Diff** | +122 / −486 across 4 files |
| **Engagement** | 15 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @pricop — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4052168102)

> # The best part
> 
> I saved the best part for the end 😅.
> 
> Since these changes don't limit us anymore to the height of the count bubble for the text container, we can now add `help text`, `badge` or any other type of decorations for the steps text, which imo is insanely helpful, as one could add a bit more information, without cluttering the UI.
> 
> ### Stepper with `help text` example:
> <img width="873" height="133" alt="localhost_9001_docs_6 0_components_stepper (10)" src="https://github.com/user-attachments/assets/5d1cca8a-6b8c-4520-a86e-2b2b8d217cab" />
> 
> Mark-up:
> ```
> <ol class="stepper stepper-horizontal w-100">
>   <li class="stepper-item active"><div><div class="fw-semibold">Create</div><div class="small fg-secondary">Create an account.</div></div></li>
>   <li class="stepper-item active"><div><div class="fw-semibold">Confirm</div><div class="small fg-secondary">Confirm your email.</div></div></li>
>   <li class="stepper-item"><div><div class="fw-semibold">Set-up</div><div class="small fg-secondary">Configure your profile.</div></div></li>
>   <li class="stepper-item"><div><div class="fw-semibold">Complete</div><div class="small fg-secondary">Welcome aboard!</div></div></li>
> </ol>
> ```
> 
> ### Stepper with `badge` and `theme` variant example
> 
> <img width="873" height="136" alt="localhost_9001_docs_6 0_components_stepper (13)" src="https://github.com/user-attachments/assets/401ff2be-186d-4a36-a47d-9ca252c5a134" />
> 
> Mark-up:
> ```
> <ol class="stepper stepper-horizontal w-100">
>   <li class="stepper-item theme-success active"><div><div>Create account</div><div class="badge badge-subtle theme-su … *[truncated]*

### @pricop — 2 reactions  
`❤️ 1 · 🎉 1`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4054042608)

> ### RTL fix
> 
> Because of the usage of physical properties such as `left`, `right`, `padding-left`, the UI breaks when viewed in RTL.
> 
> I've added logical properties instead, and the stepper now displays correctly on both directions.
> 
> **Before**
> <img width="873" height="120" alt="v6-dev--twbs-bootstrap netlify app_docs_6 0_components_stepper_" src="https://github.com/user-attachments/assets/64713491-7fe7-4404-b382-9f0bb77aca44" />
> 
> **After**
> <img width="873" height="112" alt="localhost_9001_docs_6 0_components_stepper (3)" src="https://github.com/user-attachments/assets/fc14881d-bd70-44c9-80d3-a3ad2d0c6f7b" />
> 
> Hopefully this was it. Waiting for feedback on everything 😁.

### @pricop — 1 reactions  
`👍 1`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4059554822)

> True, something like `stepper-gradient` class would be neat, however it would be rather complex to implement:
> - Start and ending bubbles would need `to right`, and `to left` gradients for Horizontal Stepper, and `to top` and `to bottom` for Vertical Stepper.
> - Middle lines would need `radial` gradients.
> - Middle lines would need to be twice as long, so colors blend in properly.
> - When there's a gap between `active` elements, would also require some dark magic to target those CSS selectors and apply the gradient in the proper direction(s).
> 
> Perhaps as a future update?

### @pricop — 0 reactions  
`—`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4051855909)

> ### Smaller track-size
> 
> Changing the `--stepper-track-size` to `.125rem` further relaxes the component by taking away the attention from the track itself, allowing bubbles and text to be more easily readable at a glance without feeling overcrowded.
> 
> The industry standard is `1px` or `2px` at max for regular font-size. For much larger font-sizes, one can increase it to `4px` or whatever, but the default should be smaller.
> 
> As a result, the stepper tracker has been reduced from `4px` down to `2px`.
> 
> **Before**
> <img width="871" height="240" alt="v6-dev--twbs-bootstrap netlify app_docs_6 0_components_stepper_ (1)" src="https://github.com/user-attachments/assets/22eb8644-f764-4f17-ac82-be9db5690d1f" />
> 
> **After**
> <img width="871" height="240" alt="localhost_9001_docs_6 0_components_stepper (3)" src="https://github.com/user-attachments/assets/9d199bd8-2220-473f-a529-c25a4d5dde53" />
> 
> For reference:
> - Tailwind UI practices `2px` width: https://tailwindcss.com/plus/ui-blocks/application-ui/navigation/progress-bars#component-4b1efed043d1ab5688c705f2e27524f3
> - Material UI practices `1px` width: https://material.angular.dev/components/stepper/overview
> - Preline UI practices `1px` width: https://preline.co/docs/stepper.html
> - Flowbite UI practices `1px` width: https://flowbite.com/docs/components/stepper/
> - ReUI practices `1px` width: https://reui.io/patterns/stepper

### @pricop — 0 reactions  
`—`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4051991254)

> ### Fixed text row for horizontal steppers
> 
> Because `.stepper-item` had `grid-template-rows` property set to `repeat(2, var(--stepper-size));`, it would force the 2nd row (the text row) to be as big in height as the counter bubble, and since the text was horizontally centered, it would make the spacing not be consistent with that of a vertical stepper.
> 
> **Before**
> <img width="871" height="240" alt="spacing1" src="https://github.com/user-attachments/assets/2c33431d-9402-4b94-bf32-f0f3704dd2bd" />
> 
> **After**
> <img width="871" height="240" alt="spacing2" src="https://github.com/user-attachments/assets/69dd2cad-896a-4343-9e08-c72d10dbc6d7" />
> 
> Furthermore, this also fixes something extremely important. Horizontal steppers will always be fighting for space on more condensed UIs (e.g: half screen container), and if the text is too long, with the old code having a **forced** height that was matching the bubble's height, the text would not fit, so it would start overflowing outside the container.
> 
> **Before**
> <img width="871" height="120" alt="v6-dev--twbs-bootstrap netlify app_docs_6 0_components_stepper_ (3)" src="https://github.com/user-attachments/assets/4fdcddae-15d3-4864-97d3-408c8707ea08" />
> 
> **After**
> <img width="871" height="160" alt="localhost_9001_docs_6 0_components_stepper (4)" src="https://github.com/user-attachments/assets/3379fb1e-423a-4685-afac-44aa56d8874f" />

### @pricop — 0 reactions  
`—`  ·  [link](https://github.com/twbs/bootstrap/pull/42165#issuecomment-4052059169)

> ### Text alignment on horizontal steppers
> 
> Adding `align-items` property set to `start` for horizontal steppers, makes the text always start at the top, regardless of whether other columns overflow to multiple lines or not, therefore the spacing will always be equal between the count bubble and the text.
> 
> **Before**
> <img width="871" height="160" alt="localhost_9001_docs_6 0_components_stepper (4)" src="https://github.com/user-attachments/assets/a16f507f-2d5f-4ae2-abb9-d1416a6a47b0" />
> 
> **After**
> <img width="871" height="160" alt="localhost_9001_docs_6 0_components_stepper (5)" src="https://github.com/user-attachments/assets/6442970d-ff01-446d-9196-bd9d5ce83ed4" />


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
