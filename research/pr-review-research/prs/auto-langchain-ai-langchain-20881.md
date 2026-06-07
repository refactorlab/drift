# langchain-ai/langchain #20881 — [experimental][llms][OllamaFunctions] Add bind_tools and with_structured_output functions to OllamaFunctions

**[View PR on GitHub](https://github.com/langchain-ai/langchain/pull/20881)**

| | |
|---|---|
| **Author** | @lalanikarim |
| **Status** | ✅ merged |
| **Opened** | 2024-04-25 |
| **Repo importance** | ★138,549 · 22,954 forks · score 235,359 |
| **Diff** | +401 / −70 across 3 files |
| **Engagement** | 79 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @lalanikarim — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2108776303)

> This PR https://github.com/langchain-ai/langchain/pull/21625 will make this fix available within `langchain-experimental` in an upcoming release.

### @kalmufti — 3 reactions  
`👍 2 · 👀 1`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2105347070)

> Following the Langgraph quick start guide. I can't get it to call the function, although it seems to be able to extract the function name and args. What am I missing if you can help?
> 
> Orignal guide: https://python.langchain.com/v0.1/docs/langgraph/
> 
> My attempt using your merge:
> ```python
> from typing import List, Literal
> 
> from langchain_community.chat_models import ChatOllama
> from langchain_core.messages import BaseMessage, HumanMessage
> from langchain_core.tools import tool
> from langchain_experimental.llms.ollama_functions import OllamaFunctions
> from langgraph.graph import END, MessageGraph
> from langgraph.prebuilt import ToolNode
> 
> @tool
> def multiply(first_number: int, second_number: int):
>     """Multiplies two numbers together."""
>     print(first_number * second_number)
>     return first_number * second_number
> 
> def router(state: List[BaseMessage]) -> Literal["multiply", "__end__"]:
>     tool_calls = state[-1].additional_kwargs.get("tool_calls", [])
>     if len(tool_calls):
>         return "multiply"
>     else:
>         return "__end__"
> 
> # model = ChatOllama(model="llama3", temperature=0)
> model = OllamaFunctions(model="llama3", temperature=0, format="json")
> model_with_tools = model.bind_tools(
>     tools=[
>         {
>             "name": "multiply",
>             "description": "return the multiplication of 2 numbers",
>             "parameters": {
>                 "type": "object",
>                 "properties": {
>                     "first_number": {
>                         "type": "int",
>                         "description": "The first number, " "e.g. 254",
>                     }, … *[truncated]*

### @lalanikarim — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2108126955)

> @kalmufti @coryoso 
> OllamaFunctions originally returned "function_call" attribute which is why it doesn't work with the new Tool calling approach. I'll look into converting it over to user "took_calls".

### @lalanikarim — 2 reactions  
`👍 2`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2143723570)

> Here is the first example from the customer service agent using OllamaFunctions
> https://github.com/lalanikarim/notebooks/blob/main/CustomerServiceAgent.ipynb

### @ntelo007 — 2 reactions  
`👍 2`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2144617472)

> > Here is the first example from the customer service agent using OllamaFunctions https://github.com/lalanikarim/notebooks/blob/main/CustomerServiceAgent.ipynb
> 
> I am getting the following error:
> `TypeError: Object of type DuckDuckGoSearchRun is not JSON serializable`

### @kalmufti — 1 reactions  
`👍 1`  ·  [link](https://github.com/langchain-ai/langchain/pull/20881#issuecomment-2108825031)

> @lalanikarim, I've tested and it works, thank you!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
