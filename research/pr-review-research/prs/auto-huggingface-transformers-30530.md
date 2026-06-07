# huggingface/transformers #30530 — Add ViTPose

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/30530)**

| | |
|---|---|
| **Author** | @NielsRogge |
| **Status** | ✅ merged |
| **Opened** | 2024-04-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +3350 / −0 across 24 files |
| **Engagement** | 46 conversation · 297 inline review comments |

## Top review comments (ranked by reactions)

### @qubvel — 2 reactions  
`👍 2`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2485982587)

> > do you think we should introduce a AutoModelForPoseEstimation or AutoModelForKeypointDetection class for this?
> 
> @xenova as soon as we have just one model for pose estimation I don't think it is necessary, what do you think?
> 
> >  I agree with the schema but I think I have seen some comment from amy that the output should be tensor. numpy is okay too?
> 
> @SangbumChoi my bad, indeed we usually return torch tensors, so no need to change this! Thanks for pointing this 🤗 
> 
> > In addition labels are equivalent to config.keypoint so I think it could be removed?
> 
> @SangbumChoi I think it's better to keep labels in the output too, it would be more obvious for users then. Also, I think one can consider threshold filtering based on confidence, labels would be useful for such cases to understand which keypoints are kept.

### @qubvel — 2 reactions  
`🎉 2`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2577686997)

> Hi @SangbumChoi! Thanks for the fixes, I will push the final fixes and merge the PR!
> 
> Checkpoints can be found here:
> https://huggingface.co/usyd-community

### @ArthurZucker — 1 reactions  
`🚀 1`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2479840254)

> Hey @SangbumChoi we were on a company wide offsite for a week, @qubvel should answer soon! 🤗

### @SangbumChoi — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2484454512)

> @xenova Hi I think it is deprecated notebook from niels. (Overall pipeline is same) Can you see the docs? If you run the docs then it will occur `edge` related problem which will be solved when we re-upload official weights.

### @SangbumChoi — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2486009237)

> > Additionally, I think it would make sense to include a threshold parameter to filter out low-scoring predictions (like [here](https://github.com/huggingface/transformers/blob/ce1d328e3b73cf6d1d993fc0d487b7dc8a14d7ee/src/transformers/models/owlv2/image_processing_owlv2.py#L470)). Another reason for this is that otherwise, labels would be meaningless (it would always return all labels, e.g., 0-16)
> 
> well this is top-down keypoint estimation so it should return all prediction. Traditionally in general pose estimation algorithm, there is an additional argument called `hide` usually used if the corresponding point is behind or occluded by object but I don't see in this model.
> 
> > Also, I think one can consider threshold filtering based on confidence, labels would be useful for such cases to understand which keypoints are kept.
> 
> I will add threshold but default value as 0. WDYT?

### @xenova — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/30530#issuecomment-2486036627)

> > @xenova as soon as we have just one model for pose estimation I don't think it is necessary, what do you think?
> 
> That's fair 👍 I mainly asked to add better ONNX export support in Optimum; see PR [here](https://github.com/huggingface/optimum/pull/2098/files#diff-e796447e084c9988c5dcb85a562008bdac1d61f7dd9a7c531bca22306a36a2f9R215). Once we have more similar models, it would make more sense to add support then! :)
> 
> The export works as is, luckily. Here is the ONNX checkpoint (& transformers.js usage): https://huggingface.co/onnx-community/vitpose-base-simple
> 
> > I will add threshold but default value as 0. WDYT?
> 
> Sounds good. Just double check something: Can the scores be < 0? I've seen scores > 1. So maybe set to `None`?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
