// drift-brain — the Drift voice-chat "brain" (Bun).
//
// A tiny loopback server that turns a conversation transcript into a streamed
// Claude reply, reusing your local `claude login` through the Agent SDK. NO API
// key: the SDK spawns the bundled Claude Code engine, which reads your
// subscription login from the OS credential store. (Verified: the Agent SDK
// runs as a local process and cannot run in a browser/Worker, and the public
// API rejects subscription OAuth tokens from non-first-party clients — which is
// exactly why this local helper exists.)
//
// Endpoints:
//   POST /turn      { systemPrompt?, transcript: {role,content}[], model? }
//                   -> text/event-stream:  data:{"text":"<delta>"} … then
//                      event:meta {durationMs,durationApiMs,ttftMs,inputTokens,…} … then event:done
//                   STATELESS: the client sends the full (capped) transcript each turn;
//                   the brain renders it into one prompt. No server session — so a
//                   barge-in (abort) just stops generation, with no session to corrupt.
//                   barge-in: aborting the request interrupts the in-flight turn.
//   GET  /health    liveness; ?deep=1 fires a REAL one-line completion to prove the
//                   whole chain (claude CLI installed + `claude login` valid + model replies).
//   GET  /docs      Swagger UI (Try-it-out).   GET /openapi.json   the spec.
//
// Run:  bun install && bun start     (after `claude` login; Bun auto-loads .env)
//
// Verified against: Bun 1.x, Claude Code 2.1.x, @anthropic-ai/claude-agent-sdk 0.3.170.

import { existsSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { renderPrompt, foldMeta, type Turn, type TurnMeta } from "./turn";
import { writeWorkspace, workspaceDirFor, type WsFile } from "./workspace";

const PORT = Number(Bun.env.PORT ?? 8787);
const HOST = Bun.env.HOST ?? "127.0.0.1"; // loopback only
const DEFAULT_MODEL = Bun.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
const CORS_ORIGIN = Bun.env.CORS_ORIGIN ?? "*"; // loopback, no credentials → * is fine
const DEFAULT_SYSTEM =
  "You are a concise voice assistant discussing a code pull request. " +
  "Reply with only what to say aloud — 1-2 short, natural spoken sentences. No markdown, no lists.";

const CORS: Record<string, string> = {
  "access-control-allow-origin": CORS_ORIGIN,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Appended to the system prompt ONLY when a diff workspace is mounted. Tells Andy
// the full diff is on disk so he reads the file he needs instead of refusing when
// the inline excerpt is trimmed. cwd is the workspace, so paths are relative.
const WORKSPACE_INSTRUCTION =
  "\n\n=== FULL DIFF ON DISK ===\n" +
  "The inline excerpt above may be trimmed. The COMPLETE diff of every changed file is in the " +
  "current directory as `<path>.diff` (see INDEX.md for the list). When a question needs detail " +
  "the excerpt doesn't have, READ the relevant `<path>.diff` (or Grep across `**/*.diff`) BEFORE " +
  "answering — prefer reading over refusing. Keep the spoken reply short even after reading.\n" +
  "=== END ===";

// STATELESS by design — NO `resume`. Every turn is a fresh one-shot query seeded
// with the full (client-capped) transcript rendered into the prompt. We deliberately
// do NOT use server-side session resume: aborting a resumed turn — which is exactly
// what a voice barge-in does — leaves a dangling assistant turn in the on-disk
// session that corrupts the NEXT resume, silently dropping context after the first
// interrupt. The client transcript is the single source of truth; the large diff
// system prompt is stable across turns so prompt caching still makes prefills cheap.
//
// `workspaceDir` (optional) mounts the PR's full diff: cwd = that dir + READ-ONLY
// tools (Read/Grep/Glob), so Andy can pull any file on demand for deep questions.
// Writes/Bash are explicitly disallowed and the dir is an isolated temp dir, so
// the tools can only ever read the diff we wrote — never the user's real files.
function buildOptions(
  systemPrompt: string | undefined,
  model: string | undefined,
  ac: AbortController,
  workspaceDir?: string,
): any {
  const opts: any = {
    model: model ?? DEFAULT_MODEL,
    systemPrompt: (systemPrompt ?? DEFAULT_SYSTEM) + (workspaceDir ? WORKSPACE_INSTRUCTION : ""),
    settingSources: [], // skip project CLAUDE.md/settings/MCP — fast, isolated
    includePartialMessages: true,
    abortController: ac,
  };
  if (workspaceDir) {
    opts.cwd = workspaceDir;
    opts.additionalDirectories = [workspaceDir];
    opts.allowedTools = ["Read", "Grep", "Glob"]; // auto-approved; everything else needs (absent) approval → denied
    opts.disallowedTools = ["Write", "Edit", "Bash", "WebFetch", "WebSearch"]; // belt-and-suspenders: never mutate / shell / net
    opts.maxTurns = 6; // bound tool round-trips so a voice answer can't spiral
  } else {
    opts.allowedTools = []; // pure chat — no tools needed
  }
  return opts;
}

// ---------- POST /turn (SSE) --------------------------------------------------

async function handleTurn(req: Request): Promise<Response> {
  let payload: { systemPrompt?: string; transcript?: Turn[]; model?: string; workspaceId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const transcript = payload.transcript;
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return json({ error: "transcript[] required" }, 400);
  }

  // Mount the PR diff workspace if the client uploaded one (POST /context) and it
  // still exists on disk. Missing/unknown id → fall back to inline-only (no tools).
  let workspaceDir: string | undefined;
  if (typeof payload.workspaceId === "string" && payload.workspaceId) {
    const dir = workspaceDirFor(payload.workspaceId);
    if (existsSync(dir)) workspaceDir = dir;
  }

  // Abort the Claude query when the client disconnects (Bun aborts req.signal).
  // For a barge-in the client aborts the fetch → this fires → generation stops.
  const ac = new AbortController();
  if (req.signal.aborted) ac.abort();
  else req.signal.addEventListener("abort", () => ac.abort());

  const options = buildOptions(payload.systemPrompt, payload.model, ac, workspaceDir);
  const prompt = renderPrompt(transcript); // stateless: the full capped transcript every turn
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      let meta: TurnMeta = {};
      try {
        for await (const msg of query({ prompt, options }) as AsyncIterable<any>) {
          if (ac.signal.aborted) break;
          meta = foldMeta(meta, msg);
          if (msg.type === "stream_event") {
            const ev = msg.event;
            if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`));
            }
          } else if (msg.type === "result" && msg.subtype !== "success") {
            const message = (msg.errors && msg.errors.join("; ")) || msg.subtype;
            controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
          }
        }
        if (!ac.signal.aborted) {
          // Tell the client how long Claude took + the real token usage for this turn.
          // Fall back to our own wall-clock if the SDK didn't report duration.
          const out = {
            durationMs: meta.durationMs ?? Date.now() - t0,
            durationApiMs: meta.durationApiMs,
            ttftMs: meta.ttftMs,
            inputTokens: meta.inputTokens,
            outputTokens: meta.outputTokens,
            cacheReadTokens: meta.cacheReadTokens,
            cacheCreationTokens: meta.cacheCreationTokens,
            costUsd: meta.costUsd,
          };
          controller.enqueue(enc.encode(`event: meta\ndata: ${JSON.stringify(out)}\n\n`));
          controller.enqueue(enc.encode("event: done\ndata: {}\n\n"));
        }
        controller.close();
      } catch (e) {
        const message = String((e as Error)?.message ?? e);
        try {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      try {
        ac.abort();
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}

// ---------- POST /context (upload a PR diff workspace) ------------------------

// Materialize a PR's full diff to an isolated temp dir so /turn can mount it with
// READ-ONLY tools (Read/Grep/Glob). This is the local-subscription equivalent of
// Managed Agents' file mounts: the extension can't use that (it's API-billed,
// cloud-sandboxed), so we write the files locally and let the SDK read them.
async function handleContext(req: Request): Promise<Response> {
  let payload: { key?: string; files?: WsFile[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!payload.key || !Array.isArray(payload.files)) {
    return json({ error: "key and files[] required" }, 400);
  }
  try {
    const res = await writeWorkspace(payload.key, payload.files);
    return json({ workspaceId: payload.key, written: res.written, skipped: res.skipped });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
}

// ---------- GET /health (deep claude-auth round-trip) ------------------------

// Fire ONE tiny real completion through the Agent SDK to prove the whole chain:
// the claude CLI is installed, `claude login` is valid, and the model replies.
async function deepCheck(): Promise<{ connected: true; reply: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    let text = "";
    let errorText: string | null = null;
    for await (const msg of query({
      prompt: "Reply with exactly: ok",
      options: { model: DEFAULT_MODEL, tools: [], settingSources: [], abortController: ac } as any,
    }) as AsyncIterable<any>) {
      if (msg.type === "assistant" && msg.error) errorText = String(msg.error);
      else if (msg.type === "result") {
        if (msg.subtype === "success") text = String(msg.result ?? "").trim();
        else errorText = (msg.errors && msg.errors.join("; ")) || msg.subtype;
      }
    }
    if (errorText && !text) throw new Error(errorText);
    return { connected: true, reply: text.slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

async function handleHealth(url: URL): Promise<Response> {
  const base = {
    ok: true,
    service: "drift-brain",
    model: DEFAULT_MODEL,
    auth: Bun.env.ANTHROPIC_API_KEY ? "api_key" : "subscription (claude login)",
    host: HOST,
    port: PORT,
  };
  if (url.searchParams.get("deep") !== "1" && url.searchParams.get("check") !== "1") {
    return json(base);
  }
  const t0 = Date.now();
  try {
    const d = await deepCheck();
    return json({ ...base, ...d, latency_ms: Date.now() - t0 });
  } catch (e) {
    const error = String((e as Error)?.message ?? e);
    const status = /auth|login|unauthor/i.test(error) ? 401 : 502;
    return json({ ...base, connected: false, error, latency_ms: Date.now() - t0 }, status);
  }
}

// ---------- GET /openapi.json + /docs ----------------------------------------

function openapiSpec(host: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "drift-brain — Drift voice-chat brain (Claude CLI)",
      version: "0.0.1",
      description:
        "Local Claude brain over your `claude login` (Agent SDK · no API key). Streams a spoken " +
        "reply for a conversation turn. `/health?deep=1` runs a real Claude round-trip to confirm " +
        "the CLI + subscription auth + model are connected end-to-end.",
    },
    servers: [{ url: `http://${host}` }],
    paths: {
      "/health": {
        get: {
          summary: "Liveness + optional deep claude-auth check",
          parameters: [
            {
              name: "deep",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["1"] },
              description: "Set to 1 to run a real Claude round-trip and confirm `claude login` + model end-to-end.",
            },
          ],
          responses: {
            200: { description: "Healthy. With deep=1 also returns connected:true, reply, latency_ms." },
            401: { description: "Deep check failed on auth — `claude login` invalid/expired." },
            502: { description: "Deep check failed — CLI/model not reachable." },
          },
        },
      },
      "/turn": {
        post: {
          summary: "Stream a spoken reply for the conversation (SSE)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["transcript"],
                  properties: {
                    systemPrompt: { type: "string", description: "Scan-grounded persona (optional)." },
                    model: { type: "string", default: "claude-opus-4-8" },
                    transcript: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["role", "content"],
                        properties: {
                          role: { type: "string", enum: ["user", "assistant"] },
                          content: { type: "string" },
                        },
                      },
                    },
                  },
                },
                example: { transcript: [{ role: "user", content: "Say hi in one short sentence." }] },
              },
            },
          },
          responses: {
            200: {
              description:
                "text/event-stream — data:{text} per token, then event:meta {durationMs,durationApiMs,ttftMs,inputTokens,outputTokens,…}, then event:done.",
            },
            400: { description: "Invalid request (transcript[] required)." },
          },
        },
      },
      "/docs": { get: { summary: "Swagger UI", responses: { 200: { description: "HTML" } } } },
    },
  };
}

const SWAGGER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>drift-brain · API docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0}.topbar{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui", deepLinking: true, tryItOutEnabled: true });
  </script>
</body>
</html>`;

// ---------- router (Bun.serve) -----------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET" && url.pathname === "/health") return handleHealth(url);
  if (req.method === "GET" && url.pathname === "/docs")
    return new Response(SWAGGER_HTML, { headers: { ...CORS, "content-type": "text/html; charset=utf-8" } });
  if (req.method === "GET" && url.pathname === "/openapi.json")
    return json(openapiSpec(req.headers.get("host") || `${HOST}:${PORT}`));
  if (req.method === "POST" && url.pathname === "/turn") return handleTurn(req);
  if (req.method === "POST" && url.pathname === "/context") return handleContext(req);
  return json({ error: "not found" }, 404);
}

console.log(`drift-brain → http://${HOST}:${PORT}  (Bun.serve · hot-reload)`);
console.log(`  POST /turn     (brain · Claude CLI · SSE)`);
console.log(`  GET  /health   (?deep=1 → real claude-auth round-trip)`);
console.log(`  GET  /docs     (Swagger)   GET /openapi.json`);
console.log(`  model: ${DEFAULT_MODEL}   auth: ${Bun.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "claude login (subscription)"}`);

// Default-export the server config (instead of calling Bun.serve directly) so
// `bun --hot` swaps the fetch handler in place on every save — no EADDRINUSE,
// the port stays bound and open SSE connections survive. `bun run` serves it too.
export default {
  port: PORT,
  hostname: HOST,
  idleTimeout: 255, // seconds (Bun max) — keep long-lived SSE turns alive
  fetch: handleRequest,
};
