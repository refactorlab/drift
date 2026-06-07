# huggingface/accelerate #3097 — POC: multiple model/configuration DeepSpeed support

**[View PR on GitHub](https://github.com/huggingface/accelerate/pull/3097)**

| | |
|---|---|
| **Author** | @muellerzr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stas00
> Testing: I think you want an actual test where you do fwd/bwd with 2 models. This is insufficient to test that it works correctly IMHO.

### @stas00
> @muellerzr, where is `zero3_init_flag: true` (accelerate config) treated in this PR? As surely it's possible not all models will want the same treatment.

### @stas00
> just flagging that this test is missing the crucial part of actually running training.

### @lewtun
> Would be good to document somewhere if/how `accelerate launch` works when two configs are needed...And then the training code assumes the first plugin comes from the first config, etc

### @stevhliu
> Very cool use case examples! Left some suggestions to reduce wordiness and be more direct, and made it clearer that the sections correspond to these use cases :)

### @lewtun
> Indeed, having a 'master' config file would be nice to have. That way I can have my Z2/Z3 configs fixed and just toggle their use based on the task at hand

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
