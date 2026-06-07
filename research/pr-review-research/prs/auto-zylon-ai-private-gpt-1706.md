# zylon-ai/private-gpt #1706 — Adding Postgres for the doc and index store

**[View PR on GitHub](https://github.com/zylon-ai/private-gpt/pull/1706)**

| | |
|---|---|
| **Author** | @dbzoo |
| **Status** | ✅ merged |
| **Opened** | 2024-03-11 |
| **Repo importance** | ★57,210 · 7,604 forks · score 92,623 |
| **Diff** | +226 / −26 across 9 files |
| **Engagement** | 17 conversation · 20 inline review comments |

## Top review comments (ranked by reactions)

### @HenrikPedDK — 0 reactions  
`—`  ·  [link](https://github.com/zylon-ai/private-gpt/pull/1706#issuecomment-1991680751)

> Hi guys. I have this version running. There is some typos in the doc and a syntax error in the node_component.py but i got it up and running. Something is very wrong when querying files compared to before. I put an example in a thread in Discord. I don't know if it's the embedding that goes wrong or something else, but if I embed the same document directly in the running Ollama instance i get much better answers (same model / document)

### @dbzoo — 0 reactions  
`—`  ·  [link](https://github.com/zylon-ai/private-gpt/pull/1706#issuecomment-1991711633)

> > There is some typos in the doc and a syntax error in the node_component.py
> 
> Those should both be fixed now.   What discord thread?

### @imartinez — 0 reactions  
`—`  ·  [link](https://github.com/zylon-ai/private-gpt/pull/1706#issuecomment-1991881071)

> > > There is some typos in the doc and a syntax error in the node_component.py
> > 
> > Those should both be fixed now. What discord thread?
> 
> Summing up: @HenrikPedDK found that using Postgres for doc and index store makes the Query Docs not work properly. I haven't tested it myself, so it is not a 100% confirmed issue (at least not the direct relation with these changes).
> 
> Copying @HenrikPedDK feedback here from Discord (moving the convo to Discord is not a good practice; having said that, happy to also chat in [Discord](https://discord.com/invite/bK6mRVpErU) ):
> 
> Okay, i have ingested a cook book that i usually test with. Before using Postgres as index/docstore i could query for a specific recipe. It can't do that anymore, it summarizes the book okay but when asking into specific things it gives answers like this:
> 
> "I apologize for any confusion earlier, but I cannot directly provide you with the Cassoulet recipe from "Cast Iron Cooking For Dummies" as I don't have access to the actual text of the book. However, I can give you a basic outline and ingredients list for making a traditional French Cassoulet in a cast iron Dutch oven or casserole dish."
> If i do the same directly on the same Ollama instance with the same document/mistral i get this answer:
> 
> Mistral:Latest 12/03/2024 13:52
> Yes, I can provide you with a recipe for Cassoulet. Here it is:
> 
> INGREDIENTS
> 
> 4 tablespoons olive oil
> 
> ½ pound haricot coverts (green beans), cleaned
> 
> 1 shallot, sliced
> 
> 2 cloves garlic, sliced
> 
> 1 tablespoon butter
> 
> ¼ cup almonds, sliced
> 
> Salt and pepper to taste
> 
> Red pepper flakes to taste
> 
> 1 pou … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
