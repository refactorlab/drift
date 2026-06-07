# ggml-org/llama.cpp #18675 — Autoparser - complete refactoring of parser architecture

**[View PR on GitHub](https://github.com/ggml-org/llama.cpp/pull/18675)**

| | |
|---|---|
| **Author** | @pwilkin |
| **Status** | ✅ merged |
| **Opened** | 2026-01-07 |
| **Repo importance** | ★114,713 · 19,193 forks · score 196,483 |
| **Diff** | +12846 / −9950 across 63 files |
| **Engagement** | 220 conversation · 116 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @pwilkin — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3723565777)

> > This feels almost magical. How does it work? Does it detect common patterns in the rendered template output? What happens if the chat template requires additional arguments?
> 
> Yeah, it does differential analysis - it prepares different inputs to the template and then tests the outputs, for example, by using a the same function signature with a different name you can identify where the function name goes, by using the same function with one and two parameters you can identify how parameters are passed etc. etc.
> 
> The nice thing is, I managed to squish it to just 2k lines of code (1k for analysis and 1k for helpers), so it's not even that bloated.
> 
> As for custom inputs - I assume standard inputs here and that's what most template makers try to adhere to anyway. If not, you end up with a custom handler like for Ministral - but as a followup I want to separate handlers from parsers (since passing extra params is much eaasier than handling an entire template from scratch) or even add autodetection for common custom keywords (we're going to have to support "reasoning" in addition to "reasoning_content" at some point because vLLM is moving to that).

### @frost555 — 6 reactions  
`👍 6`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3871432929)

> Running good with qwen coder next, no errors during ~100 tool calls (read and write files mainly)

### @pwilkin — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3887272502)

> > Architecture-wise, this looks better to the version that I reviewed last time.
> > 
> > However, even when staring at one of the analysis function for a while, like for example `analyze_tool_call_format_json_native`, I still have no idea what it's doing. The main problem is that the implementation relies heavily on substring finding operations that is quite heuristic. Maybe my brain can only comprehend graph-based and/or formal language approach.
> > 
> > I don't know what portion of the code is currently AI-generated, but it seems to me like this can be an example of human attention span is unmatched against AI. I'm not, by any means, against the use of AI for this specific part, but just want to point out that this implement may already be beyond what an individual human maintainer can comprehend.
> 
> Okay, so here's the funny part: apart from the tool call ID section, which was added during some debugging when I realized I missed it earlier, I rewrote every single analyzer function by hand.
> 
> At the beginning, I was hoping to just write the skeleton and the helper functions, then pass the general structure to Opus and let it write it. But the resulting code was too messy and too many things were (badly) hardcoded, so I had to rewrite them one by one.
> 
> The native tool call one was one of the most annoying, simply because of how many variants are there here. So let me try to explain is from the start. 
> 
> First, the key tool of the whole analyzer module is the differential analysis, fueled by the helper function `calculate_diff_split`. The idea is simple: we run the template on slight … *[truncated]*

### @pwilkin — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3897931428)

> @bfroemel so you guys might have been right - it might've been the content truncation causing the model to incorrectly infer a wrong tool calling pattern causing an error. Interesting stuff (and underscores how much things often attributed to model errors can be parser / template mistakes).

### @ngladitz — 3 reactions  
`👍 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3863872551)

> @pwilkin may or may not be related to the issue @nilnor ran into
> 
> <details>
> <summary>Test case</summary>
> 
> ```sh
> curl -N http://localhost:8080/v1/chat/completions \
> 	-H "Content-Type: application/json" \
> 	-d '{
> 		"model": "any",
> 		"stream": false,
> 		"messages": [
> 			{"role": "user", "content": "call the magic tool with the complex number real: -23.3e-6, imaginary: 4.3e9"}
> 		],
> 		"tools": [
> 			{
> 				"type": "function",
> 				"function": {
> 					"name": "magic",
> 					"description": "magic tool",
> 					"parameters": {
> 						"type": "object",
> 
> 						"properties": {
> 							"complex": {
> 								"type": "object",
> 
> 								"properties": {
> 									"real": {
> 										"type": "number"
> 									},
> 									"imaginary": {
> 										"type": "number"
> 									}
> 								},
> 
> 								"required": ["real", "imaginary"],
> 
> 								"additionalProperties": false
> 							}
> 						},
> 
> 						"required": [
> 							"complex"
> 						],
> 
> 						"additionalProperties": false
> 					},
> 					"strict": true
> 				}
> 			}
> 		],
> 		"tool_choice": "auto"
> 	}'
> ```
> 
> </details>
> 
> Relevant output:
> 
> ```
> {"error":{"code":500,"message":"[json.exception.parse_error.101] parse error at line 1, column 50: syntax error while parsing object - unexpected end of input; expected '}'","type":"server_error"}}%
> ```

### @pwilkin — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18675#issuecomment-3894449047)

> @ngxson okay, part 1 of refactoring is done.
> 
> I split the analysis structure into separate parts and the analysis functions now return or modify only their segments.
> 
> I also rewrote the `calculate_diff_split` from scratch based on the converging iterators algorithm. It turned out the old version was buggy in some edge cases and the analysis was actually relying on incorrect behavior, so I fixed that as well :)
> 
> Part 2: I'll try to rewrite what I can in the analyzer code to PEG.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
