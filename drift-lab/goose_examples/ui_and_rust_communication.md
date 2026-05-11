# Plan: How the React Desktop UI and the Rust Backend Talk to Each Other

How does a single keystroke in the Electron desktop app travel through the Rust
agent loop and come back as streaming tokens, tool calls, and confirmation
modals? This doc traces the path end to end with line-precise references.

The big surprise: **the streaming channel and the request-submission channel
are decoupled.** Posting "please reply" and listening to "what the agent is
saying" go over two different HTTP endpoints. That decomposition is the
single most load-bearing decision in this part of the codebase, and the reason
the UI can disconnect, reconnect, and replay without losing events.

---

## 0. Mental model in one picture

```
Electron main process                        goosed (Rust, Axum)                Agent loop
─────────────────────                        ───────────────────                ──────────
  spawn child process                ──►     bind 127.0.0.1:<port>
  read GOOSED_CERT_FINGERPRINT       ◄──     write fingerprint to stdout
  pin self-signed TLS cert
  build SDK client (X-Secret-Key)

React renderer                                                                  
──────────────                                                                  
  GET /sessions/:id/events  ────────────►    long-lived SSE stream ◄──── publish ─── SessionEventBus
                                                                                       ▲
  POST /sessions/:id/reply  ────────────►    spawn task ──── agent.reply() ─►          │
       { request_id, user_message }                          BoxStream<AgentEvent> ────┘
                            ◄──── { request_id }            (transformed into MessageEvent)

  POST /sessions/:id/cancel ────────────►    cancel_token.cancel()
  POST /action-required/...─────────────►    agent.handle_confirmation(...)
```

Two independent HTTP conversations carry one logical "turn":

1. **A POST** says "go" and returns the `request_id` immediately.
2. **A long-lived SSE GET** is opened *once per chat session* and carries
   every event the agent ever emits — for any number of turns, reattachable
   via `Last-Event-ID` after a reconnect.

The bus inside the Rust process fans events out to whichever subscribers
are currently attached, with a 512-event replay buffer for missed events.

---

## 1. Frameworks and runtime topology

### 1.1 Rust backend — Axum

- HTTP framework: [`axum`](https://docs.rs/axum) with the `ws` and `macros`
  features. Declared in [crates/goose-server/Cargo.toml](../crates/goose-server/Cargo.toml).
- OpenAPI generation: [`utoipa`](https://docs.rs/utoipa). Each handler is
  decorated with `#[utoipa::path(...)]` and the schema is dumped to
  `ui/desktop/openapi.json` by `just generate-openapi`.
- Async runtime: Tokio. SSE is built on `tokio::sync::broadcast` +
  `tokio_stream::wrappers::ReceiverStream`.
- Auth middleware: [crates/goose-server/src/auth.rs:9-33](../crates/goose-server/src/auth.rs#L9-L33).
  Constant-time check of `X-Secret-Key` against the secret passed via env;
  whitelists `/status`, `/features`, and the MCP proxy paths.
- TLS: self-signed cert generated at startup; the fingerprint is written to
  stdout for the Electron host to pin (see [§2.1](#21-electron-spawns-goosed)).

Routes are all merged in
[crates/goose-server/src/routes/mod.rs:31-57](../crates/goose-server/src/routes/mod.rs#L31-L57).

### 1.2 React frontend — Electron + Vite + a generated SDK

- Electron main process: [ui/desktop/src/main.ts](../ui/desktop/src/main.ts)
  spawns `goosed` and creates a `BrowserWindow` for the renderer.
- Renderer: React 18 + Redux-style reducer, bundled by Vite. Entry at
  [ui/desktop/src/renderer.tsx](../ui/desktop/src/renderer.tsx).
- HTTP client: a code-generated SDK produced from `openapi.json` by
  [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts) into
  [ui/desktop/src/api/sdk.gen.ts](../ui/desktop/src/api/sdk.gen.ts) and
  [ui/desktop/src/api/types.gen.ts](../ui/desktop/src/api/types.gen.ts). The
  client is wired up in [goosed.ts:190-200](../ui/desktop/src/goosed.ts#L190-L200)
  with the `X-Secret-Key` header injected globally.
- SSE handling lives in the generated SDK's runtime (`@hey-api/client-fetch`
  with SSE support), invoked from [useSessionEvents.ts:38-50](../ui/desktop/src/hooks/useSessionEvents.ts#L38-L50)
  via `sessionEvents({ ... })` returning `{ stream }` — an `AsyncIterable<ParsedEvent>`.

**Implication:** every call from React to Rust is typed end-to-end. If a
Rust handler changes its request/response, you must run `just generate-openapi`
or the UI build will fail — that's enforced by `AGENTS.md`.

---

## 2. Startup handshake

### 2.1 Electron spawns goosed

In [ui/desktop/src/goosed.ts:267-340](../ui/desktop/src/goosed.ts#L267-L340):

1. Pick an available local port.
2. Build env: `GOOSE_PORT=<port>`, `GOOSE_SERVER__SECRET_KEY=<random>` (the
   `__` is the config crate's nested-field separator —
   [goosed.ts:128-136](../ui/desktop/src/goosed.ts#L128-L136)).
3. `spawn(goosedPath, ['agent'], { env, cwd, stdio: [ignore, pipe, pipe] })`.
4. Watch stdout for `GOOSED_CERT_FINGERPRINT=<hex>`; once seen, that
   fingerprint is the **only** TLS cert this client will trust for that
   server process. (Self-signed certs would otherwise be rejected.)
5. Construct `baseUrl = https://127.0.0.1:<port>` and create the SDK client
   ([goosed.ts:190-200](../ui/desktop/src/goosed.ts#L190-L200)) with header
   `X-Secret-Key: <secret>`.

There's also an external-server mode (`GOOSE_EXTERNAL_BACKEND` or
`externalGoosed.url`) which skips the spawn and uses an already-running
`goosed` — useful for development.

### 2.2 First UI requests

Before any chat starts, the UI calls a few non-streaming REST endpoints:

| UI call (sdk.gen.ts) | HTTP | Rust handler | Purpose |
|---|---|---|---|
| `getStatus` | `GET /status` | [routes/status.rs](../crates/goose-server/src/routes/status.rs) | health probe (no auth) |
| `readAllConfig` / `upsertConfig` | `GET/POST /config/...` | [routes/config_management.rs](../crates/goose-server/src/routes/config_management.rs) | provider keys, settings |
| `listExtensions` | `GET /extensions` | [routes/agent.rs](../crates/goose-server/src/routes/agent.rs) | which MCP servers are wired up |
| `resumeAgent` | `POST /agent/resume` | [routes/agent.rs](../crates/goose-server/src/routes/agent.rs) | hydrate a session into the in-process Agent |
| `listSessions`, `getSession` | `GET /sessions...` | [routes/session.rs](../crates/goose-server/src/routes/session.rs) | session metadata + history |

These are all plain JSON RPCs. The streaming machinery only kicks in once
the UI hits the chat endpoints described next.

---

## 3. The streaming channel — the heart of the system

### 3.1 Two endpoints, one bus

The chat path is split across **three** routes that all live in
[crates/goose-server/src/routes/session_events.rs](../crates/goose-server/src/routes/session_events.rs):

| Route | What it does | Returns |
|---|---|---|
| `GET  /sessions/{id}/events` | Open the long-lived SSE stream | `text/event-stream` |
| `POST /sessions/{id}/reply` | Kick off a turn for that session | `{ request_id }` (immediate) |
| `POST /sessions/{id}/cancel` | Cancel an in-flight `request_id` | 200/empty |

The glue is [crates/goose-server/src/session_event_bus.rs](../crates/goose-server/src/session_event_bus.rs):

- A `tokio::sync::broadcast::Sender<SessionEvent>` for live fan-out
  (capacity 256: [session_event_bus.rs:7](../crates/goose-server/src/session_event_bus.rs#L7)).
- A `VecDeque<SessionEvent>` of size 512 for replay
  ([session_event_bus.rs:8](../crates/goose-server/src/session_event_bus.rs#L8)).
- An `AtomicU64` for monotonic `seq` numbers, written as the SSE `id:` line
  so the client can resume with `Last-Event-ID`
  ([session_event_bus.rs:50-70](../crates/goose-server/src/session_event_bus.rs#L50-L70)).
- An `active_requests: HashMap<String, CancellationToken>` so cancel-by-id
  works ([session_event_bus.rs:32](../crates/goose-server/src/session_event_bus.rs#L32)).

The bus is created lazily per session via `state.get_or_create_event_bus(&session_id)`
at [session_events.rs:149](../crates/goose-server/src/routes/session_events.rs#L149)
and [:348](../crates/goose-server/src/routes/session_events.rs#L348).

### 3.2 The event payload — `MessageEvent`

Defined as a serde-tagged enum in
[crates/goose-server/src/routes/reply.rs:126-154](../crates/goose-server/src/routes/reply.rs#L126-L154):

```rust
#[serde(tag = "type")]
pub enum MessageEvent {
    Message       { message: Message, token_state: TokenState },
    Error         { error: String },
    Finish        { reason: String, token_state: TokenState },
    Notification  { request_id: String, message: ServerNotification },
    UpdateConversation { conversation: Conversation },
    ActiveRequests     { request_ids: Vec<String> },
    Ping,
}
```

Every event the UI ever sees over SSE is one of these seven variants. The
type tag in JSON is `"type"`; payloads are flattened siblings.

The wire format from
[session_events.rs:113-115](../crates/goose-server/src/routes/session_events.rs#L113-L115):

```
id: 42
data: {"type":"Message","message":{...},"token_state":{...},"chat_request_id":"<uuid>","request_id":"<uuid>"}

```

Note two things the JSON envelope adds *outside* the `MessageEvent` schema:

- `chat_request_id` — the chat-level UUID the React listener is registered
  under. **This is how multi-turn events get routed to the right handler.**
- `request_id` — for `Notification` events this is the MCP tool-call id;
  for everything else it equals `chat_request_id`.

Heartbeats use SSE *comment* lines (`: ping 17\n\n`) so they don't advance
the client's `Last-Event-ID` cursor —
[session_events.rs:208-219](../crates/goose-server/src/routes/session_events.rs#L208-L219).

### 3.3 GET /sessions/{id}/events — the long-lived stream

[session_events.rs:132-253](../crates/goose-server/src/routes/session_events.rs#L132-L253).

Per connection:

1. Read `Last-Event-ID` header
   ([:144-147](../crates/goose-server/src/routes/session_events.rs#L144-L147)).
2. `bus.subscribe(last_event_id)` returns
   `(replay: Vec<SessionEvent>, replay_max_seq, live_rx)`.
   - If `last_event_id` was already evicted from the 512-slot buffer, return
     a single `Error{ "Client too far behind — reload conversation" }` and close
     ([:151-167](../crates/goose-server/src/routes/session_events.rs#L151-L167)).
3. Send an `ActiveRequests { request_ids }` frame **without an `id:`** so a
   reattaching client learns about in-flight turns *before* replay arrives
   ([:181-192](../crates/goose-server/src/routes/session_events.rs#L181-L192)).
4. Replay all buffered events with `seq > last_event_id`
   ([:194-201](../crates/goose-server/src/routes/session_events.rs#L194-L201)).
5. Then `tokio::select!` between heartbeat ticks and the live receiver. Live
   events with `seq <= replay_max_seq` are skipped to avoid the
   replay/live boundary duplicating
   ([:225-227](../crates/goose-server/src/routes/session_events.rs#L225-L227)).
6. If the broadcast channel reports `Lagged`, the stream closes —
   client reconnects with `Last-Event-ID` and gets the missed events from
   the replay buffer
   ([:237-242](../crates/goose-server/src/routes/session_events.rs#L237-L242)).

### 3.4 POST /sessions/{id}/reply — kick off a turn

[session_events.rs:273-598](../crates/goose-server/src/routes/session_events.rs#L273-L598).

```
POST /sessions/{id}/reply
{
  "request_id": "<uuidv7 from client>",
  "user_message": Message,
  "override_conversation": Message[] | null
}
→ 200 { "request_id": "..." }   (immediate, no SSE in the response body)
```

Notable lines:

- `request_id` must be a valid UUID
  ([:281-285](../crates/goose-server/src/routes/session_events.rs#L281-L285)).
- **Elicitation short-circuit:** if the message is an
  `ActionRequired(ElicitationResponse)`, it's routed straight to
  `agent.reply(...)` (which uses the global `ActionRequiredManager` to
  unblock a still-running tool call) and we do *not* register a new
  request or open a new logical turn
  ([:322-346](../crates/goose-server/src/routes/session_events.rs#L322-L346)).
- Otherwise, `bus.try_register_request(request_id)` claims the active slot
  and returns a `CancellationToken`. If a request is already active for the
  session, this fails with `400 "Session already has an active request"`
  ([:350-355](../crates/goose-server/src/routes/session_events.rs#L350-L355)).
  (One concurrent turn per session, by design.)
- Spawn a Tokio task that does the rest, then return
  `Json(SessionReplyResponse { request_id })`
  ([:363](../crates/goose-server/src/routes/session_events.rs#L363)).

The spawned task ([:363-524](../crates/goose-server/src/routes/session_events.rs#L363-L524))
holds a `RequestGuard` so the active-request slot is freed even on panic.
It calls:

```rust
let mut stream = agent.reply(user_message, session_config, Some(cancel_token)).await?;
```

`Agent::reply` is in
[crates/goose/src/agents/agent.rs:1049](../crates/goose/src/agents/agent.rs#L1049)
and returns `BoxStream<Result<AgentEvent>>`. (The full agent loop — outer
turn loop + inner stream loop, OpenAI vs. local-inference symmetry — is
described in [plan-iterative-agent.md](plan-iterative-agent.md).)

Then the task converts each `AgentEvent` into a `MessageEvent` and
publishes it to the bus
([session_events.rs:456-524](../crates/goose-server/src/routes/session_events.rs#L456-L524)):

| AgentEvent variant | → MessageEvent variant | Line |
|---|---|---|
| `Message(message)` | `Message { message, token_state }` | [:464-482](../crates/goose-server/src/routes/session_events.rs#L464-L482) |
| `HistoryReplaced(new_messages)` | `UpdateConversation { conversation }` | [:483-492](../crates/goose-server/src/routes/session_events.rs#L483-L492) |
| `McpNotification((req_id, n))` | `Notification { request_id, message }` | [:493-502](../crates/goose-server/src/routes/session_events.rs#L493-L502) |
| `Err(e)` | `Error { error }` then break | [:503-513](../crates/goose-server/src/routes/session_events.rs#L503-L513) |
| stream end | (drop guard → bus emits Finish) | [:514-516](../crates/goose-server/src/routes/session_events.rs#L514-L516) |

The `cancel_token.cancelled()` branch of the `select!` closes the loop early
when `/cancel` fires
([:458-461](../crates/goose-server/src/routes/session_events.rs#L458-L461)).

### 3.5 POST /sessions/{id}/cancel

Looks up the `CancellationToken` for `request_id` in `active_requests` and
cancels it. The agent loop sees the token flip and unwinds — provider
streams are dropped, in-flight tool calls get their cancel signal, and the
spawned task in §3.4 falls out of its `select!`.

---

## 4. Frontend SSE consumption

### 4.1 useSessionEvents — the single subscription

[ui/desktop/src/hooks/useSessionEvents.ts](../ui/desktop/src/hooks/useSessionEvents.ts)
owns the one and only SSE connection per chat session.

- On mount, opens `sessionEvents({ path: { id }, headers: { 'Last-Event-ID': ... } })`
  ([:38-50](../ui/desktop/src/hooks/useSessionEvents.ts#L38-L50)).
- Iterates the async iterable; each parsed event has `id` (used to update
  `lastEventId` for reconnects), `type`, plus the `chat_request_id` and
  `request_id` fields the server tacked on
  ([:54-97](../ui/desktop/src/hooks/useSessionEvents.ts#L54-L97)).
- Routes by `chat_request_id ?? request_id` to a `Map<requestId, Set<handler>>`
  registered via `addListener(requestId, handler)`
  ([:171-189](../ui/desktop/src/hooks/useSessionEvents.ts#L171-L189)).
- `ActiveRequests` events go to a separate `setActiveRequestsHandler`
  callback so the UI can reattach to in-flight turns after a remount
  ([:75-79](../ui/desktop/src/hooks/useSessionEvents.ts#L75-L79)).
- Auto-reconnects with exponential backoff on disconnect
  ([:127-156](../ui/desktop/src/hooks/useSessionEvents.ts#L127-L156)). After 10
  consecutive failures, surfaces a synthetic `Error` event to all listeners
  so they unstick from the streaming state.

### 4.2 useChatStream — submit + dispatch

[ui/desktop/src/hooks/useChatStream.ts](../ui/desktop/src/hooks/useChatStream.ts)
holds the per-chat React state (Redux-style reducer over
`{ messages, chatState, tokenState, notifications, ... }`) and orchestrates
the round-trip.

`submitToSession` ([:603-674](../ui/desktop/src/hooks/useChatStream.ts#L603-L674))
does the careful five-step dance:

1. `requestId = uuidv7()` — generated on the **client** so the listener can
   register before the POST is sent.
2. Build `processEvent = createEventProcessor(...)` (decides what each
   event type does to React state).
3. **Register the listener BEFORE the POST**
   ([:625-638](../ui/desktop/src/hooks/useChatStream.ts#L625-L638)). This
   eliminates the race where the server starts publishing events before the
   client subscribes.
4. `await sessionReply({ path: { id }, body: { request_id, user_message, override_conversation } })`
   ([:642-651](../ui/desktop/src/hooks/useChatStream.ts#L642-L651)) — this
   POST returns instantly with `{ request_id }`; the response body is
   essentially ignored, the events arrive on the long-lived SSE channel.
5. As events flow in, `processEvent` returns `true` for terminal events
   (`Finish`, `Error`); the listener self-unsubscribes.

`createEventProcessor` ([:226-344](../ui/desktop/src/hooks/useChatStream.ts#L226-L344))
maps each `MessageEvent` variant to reducer dispatches:

- `Message` → `pushMessage` (merge text deltas, push tool calls, set
  `chatState` to one of `Streaming` / `Thinking` / `CallingTool` /
  `WaitingForUserInput` based on content type).
- `UpdateConversation` → replace the entire `messages` array (used after
  history compaction or context-edit operations).
- `Notification` → push into `notifications[mcpRequestId]` for tool-progress
  UI.
- `Error` → call `onFinish('Stream error: ' + msg)`.
- `Finish` → call `onFinish()`, transition to `Idle`.
- `Ping` → ignored.

Reattachment ([:540-594](../ui/desktop/src/hooks/useChatStream.ts#L540-L594)):
when `useSessionEvents` calls `setActiveRequestsHandler` because the server
told us a request is in flight, we register a **buffering** listener while
we wait for `resumeAgent` to load the conversation history, then drain the
buffer through `processEvent` once we have the right starting state.

### 4.3 BaseChat — the consumer

[ui/desktop/src/components/BaseChat.tsx:122-125](../ui/desktop/src/components/BaseChat.tsx#L122-L125)
calls `useChatStream({ sessionId, onStreamFinish })` and pulls out
`{ messages, chatState, handleSubmit, submitElicitationResponse,
stopStreaming, tokenState, notifications, ... }`. It renders messages via
`<ProgressiveMessageList />` and disables `<ChatInput />` while
`chatState !== Idle`.

---

## 5. Tool confirmation and elicitation — out-of-band control

These are the two places where the user has to interact mid-turn. They look
similar in the UI (a modal pops up) but the wiring is different.

### 5.1 Tool confirmation — synchronous JSON RPC

When the agent reaches a tool call that needs confirmation, it sends a
`Message` whose content includes
`actionRequired { actionType: 'toolConfirmation', ... }`. That arrives over
SSE just like any other message. The agent's tool dispatch is **blocked**
inside the agent loop until the user responds.

User clicks "Allow" / "Deny" in the modal → frontend POSTs:

```
POST /action-required/tool-confirmation
{
  "id": "<confirmation_id>",
  "principal_type": "...",
  "action": "AllowOnce" | "AllowAlways" | "Deny",
  "session_id": "..."
}
```

handled at [crates/goose-server/src/routes/action_required.rs:35-52](../crates/goose-server/src/routes/action_required.rs#L35-L52),
which calls `agent.handle_confirmation(...)`. The blocked agent task wakes
up, dispatches (or skips) the tool, and continues emitting events on the
same `request_id`'s SSE channel. **No new SSE stream involved.**

### 5.2 Elicitation — back through /reply

When the agent asks a structured question (an MCP elicitation), it again
emits a `Message` with `actionRequired { actionType: 'elicitation', ... }`.
The user's response comes back as a special POST:

```
POST /sessions/{id}/reply
{
  "request_id": "<original-or-new>",
  "user_message": Message containing ActionRequired(ElicitationResponse { id, user_data })
}
```

The server detects the elicitation-response shape at
[session_events.rs:322-346](../crates/goose-server/src/routes/session_events.rs#L322-L346)
and short-circuits to `agent.reply(...)`, which calls
`ActionRequiredManager::global().submit_response(...)`. The original turn
keeps streaming on its existing `request_id`. The client uses
`submitElicitationResponse` in
[useChatStream.ts:892-919](../ui/desktop/src/hooks/useChatStream.ts#L892-L919)
for this — note that it does *not* register a new listener, because the
existing one is still attached.

---

## 6. End-to-end trace of one user turn

Walking the typical happy path top to bottom:

```
1.  User types "summarize this file" and hits Enter.
2.  React: BaseChat.handleSubmit → useChatStream.submitToSession.
3.  React: requestId = uuidv7(); register SSE listener for requestId.
4.  React: POST /sessions/<sid>/reply { request_id, user_message }.
5.  Rust:  validate UUID, claim active_request slot, spawn task, return 200.
6.  Rust:  task calls agent.reply(...) → BoxStream<AgentEvent>.
7.  Agent: build provider stream → first chunk is text delta.
8.  Rust:  AgentEvent::Message → bus.publish(MessageEvent::Message{...}).
9.  Bus:   broadcast → all subscribers of /sessions/<sid>/events.
10. Rust:  SSE writer formats `id: <seq>\ndata: {...,chat_request_id}\n\n`.
11. React: useSessionEvents iterates stream, finds chat_request_id,
           dispatches event to the listener registered in step 3.
12. React: createEventProcessor → reducer dispatch → message text appended.
13. React: ProgressiveMessageList re-renders → user sees streaming tokens.
14. Agent: produces a tool call → AgentEvent::Message (content = tool_request).
15. Rust→React: same path; React shows "Calling tool: read_file".
16. Agent: needs user permission → emits actionRequired(toolConfirmation).
17. React: modal appears.
18. User: clicks Allow.
19. React: POST /action-required/tool-confirmation (plain JSON).
20. Rust:  agent.handle_confirmation(...) → unblocks tool dispatch.
21. Agent: tool runs → AgentEvent::Message (tool_result) → SSE → React.
22. Agent: sends tool result back to LLM → next assistant chunk → SSE → React.
23. Agent: stream ends → outer task drops → MessageEvent::Finish published.
24. React: onFinish() → chatState = Idle → input re-enabled.
```

If the user hits Stop at any point: `POST /sessions/<sid>/cancel`
→ `cancel_token.cancel()` → the spawned task's `select!` exits → bus emits
the Finish/Error frame and the listener tears down.

If the user closes and reopens the window mid-turn: on remount, GET
`/sessions/<sid>/events` reconnects with `Last-Event-ID`, gets an
`ActiveRequests { request_ids }` frame, replays the events the client
missed, and resumes streaming live.

---

## 7. Why this design (validation)

I went looking for ways the design could be wrong or simpler than it is.
Each "weird" piece exists for a reason that's load-bearing:

- **Why split POST and SSE?** So you can disconnect (window minimize, sleep,
  network blip) without losing events. The replay buffer + `Last-Event-ID`
  recovery in §3.3 only works because the SSE stream is independent of
  whichever turn is currently running.
- **Why client-generated `request_id`?** So the listener can be registered
  *before* the POST is sent, eliminating the early-event race
  ([useChatStream.ts:625](../ui/desktop/src/hooks/useChatStream.ts#L625)
  before [:642](../ui/desktop/src/hooks/useChatStream.ts#L642)).
- **Why `chat_request_id` on every event?** Because the SSE stream
  multiplexes events for many turns (and many handlers — confirmation,
  elicitation, message rendering all coexist). The stream itself doesn't
  know which React listener owns which request — the routing key on every
  frame is what makes that explicit.
- **Why the broadcast channel + separate replay buffer?** `broadcast` gives
  you O(1) fan-out to N subscribers but lossy if a subscriber is slow
  (`Lagged`). The 512-deep buffer is what lets `Lagged` close the stream
  cleanly and have the client reconnect with `Last-Event-ID` and recover.
- **Why heartbeats as SSE comments (not events)?** Because writing them as
  events with their own `id:` would advance the client's `Last-Event-ID`
  cursor and evict useful events from the replay buffer over time. Comments
  keep TCP/proxies happy without touching the cursor.
- **Why two confirmation paths (plain POST for toolConfirmation,
  /reply for elicitation)?** Tool confirmation is a one-bit decision that
  unblocks the agent — `agent.handle_confirmation` is synchronous and the
  POST doesn't need a request-id flow. Elicitation feeds back structured
  user data into the LLM transcript, so it's a real `Message` and goes
  through the same `Agent::reply` entry point as any user input.
- **Why both `/reply` (legacy) and `/sessions/:id/reply` (new) coexist?**
  `reply.rs` is the original direct-SSE endpoint and is still wired into
  the router at [routes/mod.rs:34](../crates/goose-server/src/routes/mod.rs#L34).
  The desktop UI no longer uses it for new chats; the bus-based pattern
  replaced it. The `MessageEvent` enum lives in `reply.rs` because both
  paths share the same wire format.

The verification I'd do before changing anything in this surface:

1. Add an event variant → it must serialize through `serde(tag="type")`,
   pass through `serialize_session_event` correctly, type-check in the
   generated SDK after `just generate-openapi`, and have a branch in
   `createEventProcessor`. Skipping any of those four leaves the UI silently
   dropping the event.
2. Add a route → register in `routes/mod.rs`, decorate with
   `#[utoipa::path(...)]`, export from `openapi.rs`, regenerate SDK, then
   call from the UI via the typed function. There is **no** hand-rolled
   fetch on the React side, by convention.
3. Change the agent loop → the only contract that matters between
   `Agent::reply` and the HTTP layer is `Stream<Item = Result<AgentEvent>>`.
   The transformation table in §3.4 is the only place that needs updating.

---

## 8. File map (cheat sheet)

| Concern | File | Key lines |
|---|---|---|
| Server framework + auth | [crates/goose-server/src/auth.rs](../crates/goose-server/src/auth.rs) | 9-33 |
| Route registration | [crates/goose-server/src/routes/mod.rs](../crates/goose-server/src/routes/mod.rs) | 31-57 |
| `MessageEvent` enum (wire format) | [crates/goose-server/src/routes/reply.rs](../crates/goose-server/src/routes/reply.rs) | 126-154 |
| Legacy SSE endpoint | [crates/goose-server/src/routes/reply.rs](../crates/goose-server/src/routes/reply.rs) | 178-466 |
| Session-event bus | [crates/goose-server/src/session_event_bus.rs](../crates/goose-server/src/session_event_bus.rs) | 18-204 |
| GET `/sessions/{id}/events` | [crates/goose-server/src/routes/session_events.rs](../crates/goose-server/src/routes/session_events.rs) | 119-253 |
| POST `/sessions/{id}/reply` | [crates/goose-server/src/routes/session_events.rs](../crates/goose-server/src/routes/session_events.rs) | 273-598 |
| AgentEvent → MessageEvent | [crates/goose-server/src/routes/session_events.rs](../crates/goose-server/src/routes/session_events.rs) | 456-524 |
| Tool confirmation | [crates/goose-server/src/routes/action_required.rs](../crates/goose-server/src/routes/action_required.rs) | 35-52 |
| `Agent::reply` | [crates/goose/src/agents/agent.rs](../crates/goose/src/agents/agent.rs) | 1049 |
| Spawn `goosed` from Electron | [ui/desktop/src/goosed.ts](../ui/desktop/src/goosed.ts) | 267-340 |
| SDK client config (`X-Secret-Key`) | [ui/desktop/src/goosed.ts](../ui/desktop/src/goosed.ts) | 190-200 |
| Generated SDK | [ui/desktop/src/api/sdk.gen.ts](../ui/desktop/src/api/sdk.gen.ts) | (generated) |
| SSE subscriber hook | [ui/desktop/src/hooks/useSessionEvents.ts](../ui/desktop/src/hooks/useSessionEvents.ts) | 17-196 |
| Submit + dispatch hook | [ui/desktop/src/hooks/useChatStream.ts](../ui/desktop/src/hooks/useChatStream.ts) | 226-674 |
| Chat shell | [ui/desktop/src/components/BaseChat.tsx](../ui/desktop/src/components/BaseChat.tsx) | 122-125 |

Cross-refs:

- The agent's own outer/inner loop (provider-stream consumption, tool
  dispatch, max-turns, cancellation propagation): see
  [plan-iterative-agent.md](plan-iterative-agent.md).
- How a new agent flow gets wired up alongside the existing one:
  [plan_add_download_manager_add_main_llm_call_agent.md](plan_add_download_manager_add_main_llm_call_agent.md).
