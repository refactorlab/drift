// Package wsbroker implements a drop-in mock of Supabase Realtime's
// Phoenix Channels v1.0.0 protocol — every envelope this server sends
// is byte-for-byte the same shape Supabase would send, so a client
// that knows how to talk to Supabase (the drift-lab desktop UI, the
// driftdockerprofiler Python publisher, supabase-js, realtime-py) can
// point at this server with just a URL swap.
//
// What we mirror from Supabase
// ----------------------------
// Connection URL:
//
//	ws(s)://<host>/realtime/v1/websocket?apikey=<JWT>&vsn=1.0.0
//
// The `apikey` query parameter is accepted and logged (redacted) but
// not validated — this is a local / self-hosted proxy. The `vsn`
// parameter is accepted; only 1.0.0 is supported.
//
// Inbound (client → server):
//   - `phx_join`  on  `realtime:<channel>`  →  `phx_reply{ok, response:{postgres_changes:[]}}`,
//     followed by a `presence_state` and a `system{ok, "Subscribed to PostgreSQL"}` event
//     — same trio Supabase emits after a successful join.
//   - `heartbeat` on  `phoenix`              →  `phx_reply{ok, response:{}}` on `phoenix`.
//   - `phx_leave` on  `realtime:<channel>`   →  `phx_reply{ok}`, drop subscription.
//   - `broadcast` on  `realtime:<channel>`   →  fan-out to peer subscribers AND a
//     `phx_reply{ok}` for the publisher's `ref` (matches Supabase ack=true semantics).
//
// Outbound (server → client):
//   - `phx_reply` for every inbound `ref` (same `ref`, `join_ref:null` for replies).
//   - `broadcast` envelopes for every event the server received via
//     `POST /events` or via the file tailer, on every joined topic. Shape:
//
//     {"topic":"realtime:<ch>","event":"broadcast",
//      "payload":{"type":"broadcast","event":"profiler-event","payload":<event>},
//      "ref":null}
//
// What we do NOT implement
// ------------------------
// Presence updates, postgres_changes from real Postgres, RLS, JWT
// signature verification, rate limiting, broadcast acks=false toggle.
// Anyone in network range can join any channel; the apikey is read for
// logging but not enforced. Strictly local-dev / air-gapped use.
package wsbroker

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/company/drift-observability/observability-server/internal/events"
	"github.com/company/drift-observability/observability-server/internal/pubsub"
)

// marshalNoEscape is json.Marshal without the default HTML escaping.
// We need this for byte-fidelity with Supabase Realtime: most Phoenix
// clients (supabase-js, realtime-py, serde_json in the Tauri
// subscriber) emit raw `<`, `>`, `&` in JSON strings, but Go's
// json.Marshal rewrites them to < / > / & by default.
// Without this helper, a payload containing those characters would
// arrive at the client with different bytes than what was POSTed —
// and the channel-bus tee would record the escaped form, breaking
// the byte-fidelity promise of the /channels/messages endpoint.
//
// Trailing newline (which Encoder.Encode appends) is stripped because
// Phoenix frames go on the wire as a single text frame, no LF.
func marshalNoEscape(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	out := buf.Bytes()
	if n := len(out); n > 0 && out[n-1] == '\n' {
		out = out[:n-1]
	}
	return out, nil
}

// jsonNull is the marshaled form of literal JSON `null`. Used wherever
// Supabase emits `"ref": null` so we don't fall into `omitempty` and
// drop the field entirely.
var jsonNull = json.RawMessage("null")

// PhoenixHandler returns an http.HandlerFunc that upgrades the request
// to a WebSocket and runs a Phoenix Channels session against the
// supplied buses.
//
//   - `b` (legacy events broadcaster) is still read by /live_logs and
//     by older consumers; the session subscribes to it so events POSTed
//     via the legacy `POST /events` path keep reaching joined clients.
//   - `bus` is the per-topic pubsub layer. The session subscribes per
//     joined topic and writes broadcast envelopes for any payload that
//     arrives there — so an HTTP `POST /channels/publish?topic=X`
//     reaches every WS client joined to X. Inbound `broadcast` frames
//     from WS clients are also republished to `bus` so HTTP
//     subscribers see them.
//   - `cb` is an optional [ChannelBus] — every inbound and outbound
//     Phoenix frame is teed there for the `/channels/*` HTTP debug
//     endpoints. Pass `nil` to disable the tap (zero overhead).
//
// `bus` may be `nil` for legacy deployments; the session falls back
// to broadcaster-only routing.
func PhoenixHandler(b *events.Broadcaster, bus *pubsub.Bus, cb *ChannelBus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Supabase clients put the JWT on the query string AND in the
		// phx_join payload's `access_token`. We accept (and redact) the
		// former so it shows up in logs as the request lands — anything
		// invalid just gets ignored without breaking the connection.
		apikey := r.URL.Query().Get("apikey")
		vsn := r.URL.Query().Get("vsn")
		slog.Info("wsbroker: ws connect",
			"remote", r.RemoteAddr,
			"vsn", vsn,
			"apikey", redactKey(apikey),
		)

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			// Realtime clients (Tauri, supabase-js) connect from arbitrary
			// origins; the protocol carries its own auth so CORS-style
			// origin checks aren't load-bearing here.
			InsecureSkipVerify: true,
			Subprotocols:       []string{"phoenix"},
		})
		if err != nil {
			slog.Warn("wsbroker: ws accept failed", "err", err)
			return
		}
		defer conn.Close(websocket.StatusGoingAway, "session ended")

		ctx := r.Context()
		sess := newSession(conn, b, bus, cb)
		sess.run(ctx)
	}
}

// redactKey reduces a JWT to its first 6 + last 4 characters so logs
// can correlate sessions without leaking the token.
func redactKey(k string) string {
	switch {
	case k == "":
		return "<absent>"
	case len(k) <= 12:
		return "<redacted>"
	default:
		return k[:6] + "…" + k[len(k)-4:]
	}
}

// session is one WebSocket connection. Holds the set of topics this
// client has joined (so we only forward broadcasts they asked for) and
// a writer-side mutex (coder/websocket is safe for concurrent
// reads-vs-writes but not concurrent writes).
type session struct {
	conn       *websocket.Conn
	bus        *events.Broadcaster
	pubBus     *pubsub.Bus // optional per-topic pub/sub layer
	channelBus *ChannelBus // optional; nil = no per-channel tee
	writeM     sync.Mutex
	joined     sync.Map // topic → joinRef
	// pumpCancels: topic → cancel func for the per-topic pubsub pump
	// goroutine. Populated on phx_join, drained on phx_leave / session
	// teardown so a single topic-pump never leaks.
	pumpCancels sync.Map
}

func newSession(c *websocket.Conn, b *events.Broadcaster, pb *pubsub.Bus, cb *ChannelBus) *session {
	return &session{conn: c, bus: b, pubBus: pb, channelBus: cb}
}

func (s *session) run(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Subscribe to the broadcaster before we start handling frames so a
	// slow phx_join doesn't miss events the publisher emits in the
	// meantime. History snapshot is sent only after the client joins
	// (otherwise the renderer would see events with an unknown topic).
	ch, unsub := s.bus.Subscribe()
	defer unsub()

	// On disconnect, decrement the per-topic counter for every topic
	// this session was still joined to, so `GET /channels` doesn't
	// leak ghost subscribers.
	defer s.cleanupJoinedTopics()

	go s.forwardLoop(ctx, ch)

	for {
		typ, data, err := s.conn.Read(ctx)
		if err != nil {
			return
		}
		if typ != websocket.MessageText {
			continue
		}
		s.handleFrame(ctx, data)
	}
}

func (s *session) cleanupJoinedTopics() {
	// Cancel every per-topic pubsub pump goroutine first so they exit
	// cleanly before we drop the channel-bus counter.
	s.pumpCancels.Range(func(_, v any) bool {
		if fn, ok := v.(context.CancelFunc); ok {
			fn()
		}
		return true
	})
	if s.channelBus == nil {
		return
	}
	s.joined.Range(func(k, _ any) bool {
		if topic, ok := k.(string); ok {
			s.channelBus.Left(topic)
		}
		return true
	})
}

// handleFrame parses one inbound text frame and dispatches by event
// name. Malformed frames are dropped silently — Supabase does the
// same; the Phoenix client resends / retries on its own schedule.
func (s *session) handleFrame(ctx context.Context, data []byte) {
	var env inboundEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return
	}
	// Tee the raw inbound frame onto the channel bus before dispatch
	// so the /channels/live endpoint sees what the client actually
	// sent (including malformed-by-our-schema cases that still made
	// it past the json decoder).
	s.publishToChannelBus(env.Topic, DirectionIn, env.Event, data)
	switch env.Event {
	case "phx_join":
		s.handleJoin(ctx, env)
	case "phx_leave":
		if _, was := s.joined.LoadAndDelete(env.Topic); was {
			if s.channelBus != nil {
				s.channelBus.Left(env.Topic)
			}
			// Stop the per-topic pubsub pump for this topic.
			if v, ok := s.pumpCancels.LoadAndDelete(env.Topic); ok {
				if fn, ok2 := v.(context.CancelFunc); ok2 {
					fn()
				}
			}
		}
		s.writeReply(ctx, env.Topic, env.Ref, "ok", emptyResponse())
	case "heartbeat":
		// Supabase replies on `phoenix` (the inbound topic), status=ok,
		// response={}. ref preserved verbatim.
		s.writeReply(ctx, "phoenix", env.Ref, "ok", emptyResponse())
	case "broadcast":
		// Publish-over-the-same-socket path. Supabase replies with
		// phx_reply{ok} (ack=true behavior) AND fans out to peers.
		// We persist nothing here — the canonical publish channel is
		// HTTP POST /events; this only routes the broadcast to other
		// subscribers via the in-memory broadcaster.
		if inner, ok := env.Payload["payload"]; ok {
			// marshalNoEscape — same reason as outbound frames. The
			// inner payload may carry HTML-meta chars that downstream
			// SSE / channel-bus consumers expect to see verbatim.
			line, _ := marshalNoEscape(inner)
			// Publish on the per-topic bus so HTTP subscribers and
			// other WS sessions joined to this topic see it. The
			// legacy events.Broadcaster receives it too — keeps
			// /live_logs and /events history populated for clients
			// that don't speak the channel API.
			if s.pubBus != nil {
				s.pubBus.Publish(env.Topic, line)
			}
			s.bus.Push(line)
		}
		if env.Ref != "" {
			s.writeReply(ctx, env.Topic, env.Ref, "ok", emptyResponse())
		}
	}
}

// handleJoin implements the exact post-join trio Supabase emits for a
// broadcast channel: phx_reply{ok, response:{postgres_changes:[]}},
// presence_state, system{ok, "Subscribed to PostgreSQL"}.
//
// The Tauri client (and supabase-js) only requires the phx_reply, but
// real clients in the wild may also wait for the system message before
// considering the channel "ready" — so we send all three.
func (s *session) handleJoin(ctx context.Context, env inboundEnvelope) {
	if _, already := s.joined.LoadOrStore(env.Topic, env.Ref); !already {
		if s.channelBus != nil {
			s.channelBus.Joined(env.Topic)
		}
		// Spin up the per-topic pubsub pump. Any payload published to
		// this topic (via HTTP POST /channels/publish or another WS
		// client's broadcast) reaches this client as a Phoenix
		// broadcast envelope on env.Topic.
		s.startTopicPump(ctx, env.Topic)
	}

	// Echo back any postgres_changes bindings the client requested.
	// Supabase fills each binding with an `id` (subscription id) and
	// the original filter; for an empty list we just echo empty.
	var pgChanges any = []any{}
	if cfg, ok := env.Payload["config"].(map[string]any); ok {
		if pc, ok := cfg["postgres_changes"].([]any); ok {
			pgChanges = pc
		}
	}
	resp := map[string]any{"postgres_changes": pgChanges}
	s.writeReply(ctx, env.Topic, env.Ref, "ok", resp)

	// presence_state — empty until somebody track()s themselves into
	// the channel. Supabase always sends one, even if empty.
	presence := outboundEnvelope{
		Topic:   env.Topic,
		Event:   "presence_state",
		Ref:     jsonNull,
		JoinRef: jsonNull,
		Payload: json.RawMessage(`{}`),
	}
	if buf, err := marshalNoEscape(presence); err == nil {
		s.writeAndPublish(ctx, env.Topic, "presence_state", buf)
	}

	// system / "Subscribed" — Supabase emits this after the join
	// settles so the renderer can flip the badge to green.
	systemPayload, _ := marshalNoEscape(map[string]any{
		"status":    "ok",
		"extension": "postgres_changes",
		"message":   "Subscribed to PostgreSQL",
	})
	system := outboundEnvelope{
		Topic:   env.Topic,
		Event:   "system",
		Ref:     jsonNull,
		JoinRef: jsonNull,
		Payload: systemPayload,
	}
	if buf, err := marshalNoEscape(system); err == nil {
		s.writeAndPublish(ctx, env.Topic, "system", buf)
	}
}

// startTopicPump opens a pubsub subscription for `topic` and spawns
// a goroutine that pipes incoming payloads onto the wire as Phoenix
// broadcast envelopes scoped to `topic`. The pump exits when:
//
//   - the supplied context is cancelled (session-wide teardown), OR
//   - cleanupJoinedTopics / phx_leave invokes the recorded
//     CancelFunc (per-topic teardown).
//
// No-ops when pubBus is nil (legacy deployments). Idempotent — a
// repeat join on the same topic does NOT spin up a second pump.
func (s *session) startTopicPump(parent context.Context, topic string) {
	if s.pubBus == nil {
		return
	}
	if _, already := s.pumpCancels.Load(topic); already {
		return
	}
	ctx, cancel := context.WithCancel(parent)
	if _, loaded := s.pumpCancels.LoadOrStore(topic, context.CancelFunc(cancel)); loaded {
		// Lost a race; another goroutine started a pump first.
		cancel()
		return
	}
	ch, unsub := s.pubBus.Subscribe(topic)
	go func() {
		defer unsub()
		for {
			select {
			case <-ctx.Done():
				return
			case payload, ok := <-ch:
				if !ok {
					return
				}
				s.writeBroadcast(ctx, topic, payload)
			}
		}
	}()
}

// writeBroadcast wraps `payload` in a Supabase-shape Phoenix broadcast
// envelope and sends it on the wire. Shared by the per-topic pubsub
// pump and the legacy events.Broadcaster fanOutEvent path.
func (s *session) writeBroadcast(ctx context.Context, topic string, payload []byte) {
	inner := broadcastPayload{
		Type:    "broadcast",
		Event:   "profiler-event",
		Payload: json.RawMessage(payload),
	}
	innerJSON, err := marshalNoEscape(inner)
	if err != nil {
		return
	}
	env := outboundEnvelope{
		Topic:   topic,
		Event:   "broadcast",
		Ref:     jsonNull,
		JoinRef: jsonNull,
		Payload: innerJSON,
	}
	buf, err := marshalNoEscape(env)
	if err != nil {
		return
	}
	s.writeAndPublish(ctx, topic, "broadcast", buf)
}

// forwardLoop pumps broadcaster output onto the wire as Phoenix
// `broadcast` envelopes, one per joined topic. Closes when ch closes
// (broadcaster shutdown) or ctx is cancelled (client disconnect).
//
// We intentionally do NOT send a server-side keepalive: Phoenix is
// client-driven (heartbeat every ~30 s from the client). Adding our
// own would diverge from Supabase's wire shape and confuse some
// clients.
func (s *session) forwardLoop(ctx context.Context, ch events.Subscriber) {
	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-ch:
			if !ok {
				return
			}
			s.fanOutEvent(ctx, line)
		}
	}
}

// fanOutEvent sends one legacy-broadcaster line to every topic this
// client has joined. Phoenix keys broadcasts by topic, not by
// subscription id, so the same line is repeated per topic.
//
// Used only for events.Broadcaster traffic (legacy POST /events and
// file tailer). The per-topic pubsub path uses startTopicPump
// directly without this fan-out — each pump knows its own topic.
func (s *session) fanOutEvent(ctx context.Context, line []byte) {
	s.joined.Range(func(k, _ any) bool {
		if topic, ok := k.(string); ok {
			s.writeBroadcast(ctx, topic, line)
		}
		return true
	})
}

// writeReply emits a Supabase-shaped phx_reply:
//
//	{"topic":"<inbound>","event":"phx_reply","ref":"<inbound>",
//	 "join_ref":null,"payload":{"status":"ok","response":{...}}}
func (s *session) writeReply(ctx context.Context, topic, ref, status string, response any) {
	respJSON, err := marshalNoEscape(response)
	if err != nil {
		respJSON = []byte(`{}`)
	}
	payloadJSON, err := marshalNoEscape(replyPayload{
		Status:   status,
		Response: respJSON,
	})
	if err != nil {
		return
	}
	// `ref` from the client comes back as the same string. `join_ref`
	// is always null on a reply — Supabase always nulls it out.
	refJSON, _ := marshalNoEscape(ref)
	env := outboundEnvelope{
		Topic:   topic,
		Event:   "phx_reply",
		Ref:     refJSON,
		JoinRef: jsonNull,
		Payload: payloadJSON,
	}
	buf, err := marshalNoEscape(env)
	if err != nil {
		return
	}
	s.writeAndPublish(ctx, topic, "phx_reply", buf)
}

func (s *session) writeRaw(ctx context.Context, data []byte) error {
	s.writeM.Lock()
	defer s.writeM.Unlock()
	wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.conn.Write(wctx, websocket.MessageText, data)
}

// writeAndPublish writes `data` to the wire AND tees it onto the
// channel bus (direction=out). Used for every server-initiated frame
// so the /channels/live HTTP endpoint sees the same bytes the client
// did. The tee runs only on a successful write — a wire-level error
// would mean the client never saw the frame, so neither should the
// debug viewer.
func (s *session) writeAndPublish(ctx context.Context, topic, event string, data []byte) {
	if err := s.writeRaw(ctx, data); err != nil {
		return
	}
	s.publishToChannelBus(topic, DirectionOut, event, data)
}

// publishToChannelBus is the single point where every observed frame
// reaches the bus. Centralised so adding a new write site doesn't
// require thinking about the tee — call writeAndPublish or invoke
// this helper directly for inbound.
func (s *session) publishToChannelBus(topic string, dir Direction, event string, data []byte) {
	if s.channelBus == nil {
		return
	}
	// json.RawMessage references the caller's bytes. Copy so a later
	// mutation can't tear the ring entry — every frame stored is
	// owned by the bus.
	cp := make([]byte, len(data))
	copy(cp, data)
	s.channelBus.Publish(Frame{
		Topic:     topic,
		Direction: dir,
		Event:     event,
		Frame:     cp,
	})
}

func emptyResponse() map[string]any { return map[string]any{} }

// --- envelopes --------------------------------------------------------------

type inboundEnvelope struct {
	Topic   string                 `json:"topic"`
	Event   string                 `json:"event"`
	Ref     string                 `json:"ref"`
	JoinRef string                 `json:"join_ref"`
	Payload map[string]interface{} `json:"payload"`
}

// outboundEnvelope is the Phoenix v1.0.0 wire shape. `Ref` and
// `JoinRef` are `json.RawMessage` so we can emit literal `null`
// (Supabase's idiom for server-initiated frames) without `omitempty`
// stripping the field entirely.
//
// `Payload` is also `json.RawMessage` because the union of its
// possible shapes (broadcast / reply / presence / system) is too wide
// to model as a Go struct cleanly; we marshal each shape into raw
// JSON first.
type outboundEnvelope struct {
	Topic   string          `json:"topic"`
	Event   string          `json:"event"`
	Ref     json.RawMessage `json:"ref"`
	JoinRef json.RawMessage `json:"join_ref"`
	Payload json.RawMessage `json:"payload"`
}

type broadcastPayload struct {
	Type    string          `json:"type"`
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

type replyPayload struct {
	Status   string          `json:"status"`
	Response json.RawMessage `json:"response"`
}
