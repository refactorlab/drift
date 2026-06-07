# huggingface/transformers #29886 — Add SuperGlue model

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/29886)**

| | |
|---|---|
| **Author** | @sbucaille |
| **Status** | ✅ merged |
| **Opened** | 2024-03-26 |
| **Repo** | curated review-culture seed |
| **Diff** | +2777 / −6 across 21 files |
| **Engagement** | 58 conversation · 337 inline review comments |

## Top review comments (ranked by reactions)

### @qubvel — 2 reactions  
`🎉 2`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2602042265)

> Congratulations @sbucaille on the model merged 🎉 🎉 🎉  Fantastic work! Thanks for iterating so many times to follow our standards 🤗

### @amyeroberts — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2049669768)

> > So we agree that saving a SuperGlueForImageMatching weights in a new Hub repo necessarily means we also save the keypoint_detector weights with it right ? Is this how it is implemented in LlaVa ?
> 
> Yep, that's how it's done in Llava and other composite models. You can check this by inspecting the safetensor weight names on the hub for a checkpoint: https://huggingface.co/llava-hf/llava-v1.6-mistral-7b-hf/tree/main (Click on this symbol: <img width="44" alt="image" src="https://github.com/huggingface/transformers/assets/22614925/db320671-7c36-4292-8151-2df97cbf85aa">)
> 
> > In SuperPoint it was not that noticeable, but for example, with the two images I've added in this PR, using the SuperPointImageProcessor (which uses PIL.Image.open())
> 
> None of our image processors should be using `PIL.Image.open`. They should take already opened images. I can't see [where it's used in the image processor](https://github.com/huggingface/transformers/blob/6cdbd73e01a9719bfaec07d91fd108e8d932bbbb/src/transformers/models/superpoint/image_processing_superpoint.py#L4)? 
> 
> The image processors accept `PIL.Image.Image`, `torch.tensor`, `jax.array`, `tf.tensor` or `np.array`, but it's not responsible for loading / opening images. If for testing the port you want to use cv and then convert the images to one of these formats, that should be OK. 
> 
> It would be interesting to know what the difference is between the two images after loading from PIL vs cv2

### @qubvel — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2382873334)

> Hi @sbucaille, thanks for working on this PR and sorry for a long waiting! I will review it this week :slightly_smiling_face:

### @qubvel — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2399664920)

> Hi @sbucaille!
> 
> Thanks for the answer, I see now that we are using `descriptors` from SuperPoint, which means we are model-dependent. In that case, it's the correct way to include SuperPoint inside the SuperGlue. My bad, I overlooked it previously, thanks for the clarifications!
> 
> Regarding https://github.com/huggingface/transformers/pull/33200, I hope it will be merged soon!
> 
> Also, I think `post_process_keypoint_matching ` should be included in this PR to superglue the image processor to have a full model inference pipeline ready with the merge!

### @sbucaille — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2504271526)

> @qubvel nothing to add on the notes ! I've made the last change about the `matching_threshold` parameter, updated the configs and docs on the Hub. I also removed some typos and errors here and there that I noticed. @ArthurZucker 's fresh eye will be useful to catch the potential last ones 😄

### @qubvel — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/29886#issuecomment-2514187427)

> Thanks, @sbucaille! Arthur is on/off this week, but hopefully, he will be able to review it then. Thanks for your patience 🤗


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
