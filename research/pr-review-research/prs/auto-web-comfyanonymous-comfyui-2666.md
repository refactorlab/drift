# comfyanonymous/ComfyUI #2666 — Execution Model Inversion

**[View PR on GitHub](https://github.com/comfyanonymous/ComfyUI/pull/2666)**

| | |
|---|---|
| **Author** | @guill |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @blepping
> the method can return `None` however the downstream code doesn't check for that... there definitely should be more graceful handling for methods that can return `None`.

### @ltdrdata
> I see that compatibility of existing custom nodes may be compromised with the new structure. More important than immediate compatibility breaking is verifying whether each extension can provide compatibility patches for the new structure.

### @Trung0246
> The root cause is kinda hard to explain, but... `IsChangedCache.get` is forced to call `get_input_data`, which at that point `BasicCache.cache_key_set` is not initialized yet, hence the assertion crash.

### @ricklove
> LoadImage.load_image() got an unexpected keyword argument 'upload'... something is breaking LoadImage node

### @rgthree
> I assume this PR will render the rgthree optimization obsolete?... the patch I provide reduces iterations... from 250,496,808 to just 142

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
