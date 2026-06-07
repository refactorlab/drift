# vllm-project/vllm #20859 — [Feature] limit thinking tokens (hard limit)

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/20859)**

| | |
|---|---|
| **Author** | @llsj14 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aarnphm
> You can probably create a logit_processors dir, then put diff logic processor there. The default ones can just live under `logit_processors/__init__.py`, and others can have its own file.

### @aarnphm
> Can we introduce some heuristic with `reasoning_effort`. I'm thinking: low -> 1024, medium -> 2048, high -> 8192

### @chaunceyjiang
> Using `reasoning_parser.think_start_token_id` directly doesn't seem like a good approach—I suggest using a `@property` instead.

### @njhill
> My main issue here is that we're exposing a new arg / config parameter externally that isn't really required...Let's at least add a comment explaining that setting the parameter shouldn't be required.

### @hmellor
> There's no need to make this config `Optional` you can default construct the actual config...`reasoning_config: ReasoningConfig = field(default_factory=ReasoningConfig)`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
