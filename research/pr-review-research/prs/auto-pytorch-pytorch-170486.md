# pytorch/pytorch #170486 — [flex_attention] adds support for low precision K/V inputs in compiled mode with GPU

**[View PR on GitHub](https://github.com/pytorch/pytorch/pull/170486)**

| | |
|---|---|
| **Author** | @howardzhang-cv |
| **Status** | ✅ merged |
| **Opened** | 2025-12-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +375 / −24 across 10 files |
| **Engagement** | 21 conversation · 14 inline review comments |

## Top review comments (ranked by reactions)

### @howardzhang-cv — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3667974131)

> @pytorchbot label "module: flex attention" "release notes: nn"

### @howardzhang-cv — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3689131735)

> @pytorchbot merge -f '[MINOR] CI failure is unrelated, safe to merge.'

### @atalman — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3697123671)

> @pytorchmergebot revert -c ghfirst -m "Looks like forward fix is can't be landed right now, hence reverting. Sorry"

### @howardzhang-cv — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3667969831)

> @pytorchbot label "topic: flex_attention" "release_notes: nn"

### @howardzhang-cv — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3673432380)

> Added additional CI tests with numeric checks with SQNR (with per-tensor and per-head scaling). I'm not quite sure if I did an accurate simulation of the quantization. Can you take a look over it and see if this is an alright way to do it? I basically just did a simple scaling term based on max value/torch.float8 max value. I get a SQNR of 27-28 when using torch.randn but it drops much lower with torch.testing.make_tensor to 16-17 (I'm guessing because the range of values is higher and has a more uniform distribution). 
> 
> Also for checking the error thrown in backwards, users can't do .backwards without first doing a forward pass right? In which case the forward pass will throw the error we expect?

### @howardzhang-cv — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/170486#issuecomment-3693311993)

> @howardzhang-cv has imported this pull request.  If you are a Meta employee, you can view this diff [on Phabricator](https://www.internalfb.com/diff/D89820697).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
