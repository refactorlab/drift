# docling-project/docling #630 — feat: Enable markdown text formatting for docx

**[View PR on GitHub](https://github.com/docling-project/docling/pull/630)**

| | |
|---|---|
| **Author** | @SimJeg |
| **Status** | ✅ merged |
| **Opened** | 2024-12-19 |
| **Repo importance** | ★61,011 · 4,260 forks · score 83,049 |
| **Diff** | +852 / −86 across 6 files |
| **Engagement** | 28 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @dolfim-ibm — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2590588700)

> We actually are considering something similar to what you are proposing.
> 
> Adding the option for the format at convert time (with default None) is good, but we would like to have them in the PipelineOptions for the MS Word backend, since it will be something specific to it.
> 
> We will soon post more details, but the above is the general idea.

### @vagenas — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2730239236)

> Hi @SimJeg, with https://github.com/docling-project/docling-core/pull/182 we introduced —as beta— a Serialization API operating against the DoclingDocument. This also includes formatting.
> 
> [This test code](https://github.com/docling-project/docling-core/blob/65a82a158c41510a464410fd109a0f62a0b3c557/test/test_docling_doc.py#L785-L827) shows how the various formatting options can be set.
> 
> 👉  Can you update your PR so that it sets these formatting options when adding the respective items to the DoclingDocument?
> 
> The actual export to the various output formats should not be part of this PR as it will be taken care of by the new Serialization API — e.g. the Markdown export is already using the new API & automatically exports bold, italics, strikethrough, and hyperlinks.

### @vagenas — 1 reactions  
`🎉 1`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2775747292)

> Thanks for this nice contribution @SimJeg! 🙌

### @SimJeg — 0 reactions  
`—`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2554279049)

> Note: for underline I used the` <u>` / `</u>` tags that are not rendered on GitHub 😅

### @SimJeg — 0 reactions  
`—`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2562359944)

> @maxmnemonic @PeterStaar-IBM do you need any additional info for this PR ?

### @dolfim-ibm — 0 reactions  
`—`  ·  [link](https://github.com/docling-project/docling/pull/630#issuecomment-2572593533)

> @SimJeg this is an interesting feature, but we should introduce it with an option for enable/disable, because not all output formats will be compatible with markdown styling. There could also be some consideration on whether to propagate text styling in the Docling document format, but the option will be needed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
