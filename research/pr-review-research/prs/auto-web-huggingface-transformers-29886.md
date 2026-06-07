# huggingface/transformers #29886 — Add SuperGlue model

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/29886)**

| | |
|---|---|
| **Author** | @sbucaille |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @amyeroberts
> I think it would be better to have these layers just take one image, and then call this layer twice and combine as needed in the final stages.

### @amyeroberts
> The pattern for other models is a tuple of tensors is returned, with each element in the tensor representing a layer or block of the model.

### @ArthurZucker
> it's better to just copy the function as conversion files are supposed to be runnable and usable alone!

### @ArthurZucker
> validate_and_format_image_pairs being too big

### @qubvel
> do we have `matplotlib` dependency? otherwise, I would better just provide snippets in docs

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
