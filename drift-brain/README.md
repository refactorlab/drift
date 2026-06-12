# drift-brain

The local **brain** for Drift's in-browser voice chat. Reuses your terminal **`claude login`** (the
Claude Code subscription login) through the **Agent SDK** — **no API key**. The extension side panel
sends it a transcript over loopback HTTP and gets a streamed Claude reply. Runs on **Bun**.

> Why local? The Agent SDK bundles a native Claude binary and runs as a local process — it can't run
> in a browser or a Cloudflare Worker, and the public API **rejects subscription OAuth tokens from
> non-first-party clients** (the ToS also forbids reusing them). So this tiny Bun server is the one
> local piece; everything else (mic, Cloudflare STT/TTS, UI) runs in the extension. It's also the
> only sanctioned way to bill inference to your **subscription** (vs. a pay-as-you-go API key).

## Prereqs
- **Bun** ≥ 1.1 — https://bun.sh (`curl -fsSL https://bun.sh/install | bash`)
- Logged into Claude in your terminal — `claude` then `/login`, or `claude auth login` /
  `claude setup-token` (mints a long-lived `CLAUDE_CODE_OAUTH_TOKEN`, best for an always-on brain).

## Run
From the repo root (recommended — installs + hot-reload):
```bash
make drift-brain                 # bun install + bun --hot → http://127.0.0.1:8787
```
Or directly:
```bash
cd drift-brain
bun install
bun dev                          # hot-reload (bun --hot) — swaps the handler on save, keeps the port
bun start                        # no reload
```
Uses your `claude login` (no API key). Lower latency / port override:
`PORT=9000 ANTHROPIC_MODEL=claude-haiku-4-5 make drift-brain`. Bun auto-loads `.env`.

## Test it (no extension needed)
```bash
# 1) Prove the whole chain — claude CLI installed + `claude login` valid + model replies:
curl -s 'http://127.0.0.1:8787/health?deep=1' | jq
#   → { "ok": true, "model": "claude-opus-4-8", "auth": "subscription (claude login)",
#       "connected": true, "reply": "ok", "latency_ms": 1234 }
#   (401 if your login is invalid/expired; 502 if the CLI/model isn't reachable.)

# 2) Stream a real turn:
curl -N -X POST http://127.0.0.1:8787/turn \
  -H 'content-type: application/json' \
  -d '{"systemPrompt":"You discuss a PR. Be brief.","transcript":[{"role":"user","content":"Give me a one-sentence hello."}]}'
#   → data: {"text":"..."} … then  event: done
```
Or open **http://127.0.0.1:8787/docs** (Swagger UI) to explore and "Try it out" in the browser.

## Endpoints
- `GET /health` — liveness (`ok`, model, auth, port). **`?deep=1`** runs a real Claude round-trip and
  returns `connected` + `reply` + `latency_ms` (401 on auth failure, 502 if unreachable).
- `POST /turn` — the SSE brain turn (below).
- `GET /docs` — Swagger UI · `GET /openapi.json` — the spec.

## API
`POST /turn` (SSE response)
```jsonc
{
  "systemPrompt": "string (optional) — scan-grounded persona, built by the extension",
  "transcript": [ { "role": "user" | "assistant", "content": "string" } ],   // required
  "model": "claude-opus-4-8 (optional)"
}
```
- Streams `data: {"text":"<delta>"}` per token, then `event: done`.
- Errors stream as `event: error\ndata: {"message":"..."}`.
- **Barge-in:** abort the HTTP request and the in-flight turn is interrupted (`q.interrupt()`).

`GET /health` → `ok`.

## Notes
- Built on **`Bun.serve` + Web Streams**; `bun --watch` for live reload (`bun dev`).
- Binds to `127.0.0.1` only — not reachable off your machine. No secrets stored here.
- Stateless per turn: the extension sends the full transcript each time (the scan grounding rides in
  `systemPrompt`).
- ⚠ If a future Agent SDK changes the abort surface, swap `q.interrupt()` accordingly.
