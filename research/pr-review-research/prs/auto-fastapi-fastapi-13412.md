# fastapi/fastapi #13412 — 🌐 Add Russian translation for  `docs/ru/docs/tutorial/middleware.md`

**[View PR on GitHub](https://github.com/fastapi/fastapi/pull/13412)**

| | |
|---|---|
| **Author** | @alv2017 |
| **Status** | ✅ merged |
| **Opened** | 2025-02-23 |
| **Repo importance** | ★98,937 · 9,401 forks · score 141,528 |
| **Diff** | +74 / −0 across 1 files |
| **Engagement** | 19 conversation · 59 inline review comments |

## Top review comments (ranked by reactions)

### @alv2017 — 2 reactions  
`👀 2`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2678951119)

> @Rishat-F, @Yarous, @Xewus, @Stepakinoyan, @gitgernit 
>  
> сделайте review пожалуйста :blush:

### @alv2017 — 2 reactions  
`😄 1 · 😕 1`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2684817460)

> экспериментальная middleware :smile:
> 
> ```python
> from fastapi import FastAPI, Request
> 
> app = FastAPI()
> 
> @app.get("/")
> def hello():
>     return {"message": "Hello from GET"}
> 
> @app.post("/")
> def hello():
>     return {"message": "Hello from POST"}
> 
> @app.middleware("http")
> async def add_demo_middleware(request: Request, call_next):
>     if request.scope["method"] == "GET":
>         request.scope["method"] = "POST"
>     elif request.scope["method"] == "POST":
>         request.scope["method"] = "GET"
> 
>     response = await call_next(request)
>     response.headers["X-Method"] = f"Request method: {request.method}"
>     return response
> 
> if __name__ == "__main__":
>     import uvicorn
>     uvicorn.run(app, host="localhost", port=8080, lifespan="on")
> ```

### @alv2017 — 1 reactions  
`👀 1`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2681761499)

> @Rishat-F : последние поправки удобно просмотреть здесь: https://github.com/fastapi/fastapi/pull/13412/commits/bb4077a21c01ee3174f652fb09c3dfe5cc0241d0

### @alejsdev — 1 reactions  
`🚀 1`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2691154469)

> Great, thank you for your contribution! @alv2017 :rocket: 
> And thanks for your reviews @Rishat-F @Yarous :sparkles:

### @alv2017 — 0 reactions  
`—`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2687338622)

> @Yarous, @Rishat-F: добавила поправки и уточнила перевод  :innocent:

### @alv2017 — 0 reactions  
`—`  ·  [link](https://github.com/fastapi/fastapi/pull/13412#issuecomment-2690604726)

> @Yarous, уже всё поправили, ждём тебя :smile:


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
