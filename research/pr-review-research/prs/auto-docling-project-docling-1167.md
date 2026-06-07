# docling-project/docling #1167 — feat(ocr): tesseract support mis-oriented documents

**[View PR on GitHub](https://github.com/docling-project/docling/pull/1167)**

| | |
|---|---|
| **Author** | @ClemDoum |
| **Status** | ✅ merged |
| **Opened** | 2025-03-14 |
| **Repo importance** | ★61,011 · 4,260 forks · score 83,049 |
| **Diff** | +9864 / −5258 across 96 files |
| **Engagement** | 23 conversation · 11 inline review comments |

## Top review comments (ranked by reactions)

### @cau-git — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2895350678)

> @ClemDoum The CI tests reveal some failure now on tesseract-related test units, could you have a check there too? Many thanks

### @cau-git — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2774869684)

> @ClemDoum Many thanks for the updates. I missed to point you to the BoundingRectangle convention, we define it like this for an upright rectangle.
> 
> ```
>       rx_3, ry_3        rx_2, ry_2
>          +----------------+
>          |                |
>          |      Text      |
>          |                |
>          +----------------+
>       rx_0, ry_0        rx_1, ry_1
> ```
> That is, the (rx_0, ry_0) is the bottom left corner, no matter in which `CoordOrigin`, and then the coordinates go counter-clockwise.

### @cau-git — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2774889386)

> > Additionally, do you want me to use the same rotation trick in the `LayoutModel` or are there some plans to make it rotation independent ?
> 
> Yes, we would like to adopt the rotation correction you implement for tesseract here into the Layout Model and the TableFormer model, in the way you suggested (through a heuristic that determines the majority direction of the text cells).
> @ClemDoum Would you be willing to help on this? @maxmnemonic will give you pointers in case.

### @maxmnemonic — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2775006490)

> @ClemDoum, as @cau-git mentioned, if you want to help us with cluster rotations, you are very welcome!
> We have a way to determine cluster orientation from orientation of each underlying PDF cells with new (default) PDF backend.
> And here is an example on how you can do it: https://github.com/docling-project/docling/pull/1286/files
> 
> Please let us know if you would like to proceed with this, thanks!

### @ClemDoum — 1 reactions  
`👀 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2779201785)

> @maxmnemonic concerning the `TableStructureModel` could you confirm that the steps to support rotation would be:
> 1. detect if the page is rotated using it cells
> 2. rotate it to the natural orientation
> 3. rotate the `tbl_box`
> 
> But then I'm a bit lost:
> - I guess I should rotate the `page_input["tokens"]["bbox"]` accordlingly ?
> - should i also reorder the `page_input["tokens"]` themselves (are they expected to be in some particular order ?) ?
> - then I guess once the `tf_predictor` has made prediction, I guess I should rotate the results back to the original image orientation ?

### @cau-git — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/1167#issuecomment-2782491682)

> > @cau-git I've updated the `LayoutModel`, however unit test are still not looking good because I think there's some bugs in the `BoundingRectangle.angle_360` (and maybe also `angle`). When we get an `tan(thêta) = 0` which is `delta_y = 0` we consider online one of the possible solutions (`0`) however the solution are only unique between `[-pi / 2, pi /2]`. Since we consider solution between `[0, 2pi]` (or `[-pi, pi]`), there are other solutions and we need to consider the `delta_x` to find the right one.
> > 
> > I think it should be something like this instead:
> > ...
> 
> @ClemDoum Many thanks. Can you make a companion PR on `docling-core` where you update [the angle_360 implementation](https://github.com/docling-project/docling-core/blob/main/docling_core/types/doc/page.py#L132-L145) as you suggest?  Many thanks.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
