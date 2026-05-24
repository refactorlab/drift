// wsbroker_test verifies the Phoenix-Channels-emulating WebSocket
// broker matches Supabase Realtime's wire format byte-for-byte where
// it matters to the existing drift clients (drift-lab Tauri
// subscriber, driftdockerprofiler Python publisher).
//
// Each test spins up an httptest.Server with PhoenixHandler bound to
// a fresh broadcaster, opens a real WebSocket against it, and asserts
// on the JSON envelopes. No mocks — the wire format is the contract.
package wsbroker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/company/drift-observability/observability-server/internal/events"
)

// dialBroker starts an httptest server with PhoenixHandler and dials
// it via a real WebSocket client. Returns the connection, the
// broadcaster (so tests can push events server-side), and a cleanup.
func dialBroker(t *testing.T, query string) (*websocket.Conn, *events.Broadcaster, func()) {
	t.Helper()
	bus := events.New(100)
	srv := httptest.NewServer(PhoenixHandler(bus, nil, nil))
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	if query != "" {
		url += "?" + query
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		Subprotocols: []string{"phoenix"},
	})
	if err != nil {
		srv.Close()
		t.Fatalf("dial broker: %v", err)
	}
	return conn, bus, func() {
		_ = conn.Close(websocket.StatusNormalClosure, "test done")
		srv.Close()
	}
}

// readJSON reads one text frame and decodes it into a generic map.
func readJSON(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("read frame: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("decode frame %s: %v", data, err)
	}
	return m
}

func writeJSON(t *testing.T, conn *websocket.Conn, v any) {
	t.Helper()
	buf, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := conn.Write(ctx, websocket.MessageText, buf); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func joinPayload(token string) map[string]any {
	return map[string]any{
		"config": map[string]any{
			"broadcast":        map[string]any{"ack": false, "self": false},
			"presence":         map[string]any{"key": ""},
			"postgres_changes": []any{},
			"private":          false,
		},
		"access_token": token,
	}
}

// TestPostJoinTrio: after phx_join we get phx_reply{ok, response:{postgres_changes:[]}},
// then presence_state, then system{Subscribed} — Supabase's exact post-join sequence.
func TestPostJoinTrio(t *testing.T) {
	conn, _, done := dialBroker(t, "apikey=jwtjwtjwtjwt&vsn=1.0.0")
	defer done()

	writeJSON(t, conn, map[string]any{
		"topic":    "realtime:drift",
		"event":    "phx_join",
		"ref":      "1",
		"join_ref": "1",
		"payload":  joinPayload("jwtjwtjwtjwt"),
	})

	// 1. phx_reply
	reply := readJSON(t, conn)
	if reply["event"] != "phx_reply" {
		t.Fatalf("first frame should be phx_reply, got %v", reply["event"])
	}
	if reply["topic"] != "realtime:drift" {
		t.Errorf("topic mismatch: %v", reply["topic"])
	}
	if reply["ref"] != "1" {
		t.Errorf("ref mismatch: %v", reply["ref"])
	}
	// join_ref must be literal null on a server-emitted reply.
	if v, ok := reply["join_ref"]; !ok || v != nil {
		t.Errorf("join_ref should be JSON null, got %#v (present=%v)", v, ok)
	}
	pl, _ := reply["payload"].(map[string]any)
	if pl["status"] != "ok" {
		t.Errorf("status not ok: %v", pl["status"])
	}
	resp, _ := pl["response"].(map[string]any)
	if _, ok := resp["postgres_changes"]; !ok {
		t.Errorf("response.postgres_changes missing: %v", resp)
	}

	// 2. presence_state
	pres := readJSON(t, conn)
	if pres["event"] != "presence_state" {
		t.Fatalf("expected presence_state, got %v", pres["event"])
	}

	// 3. system / "Subscribed to PostgreSQL"
	sys := readJSON(t, conn)
	if sys["event"] != "system" {
		t.Fatalf("expected system, got %v", sys["event"])
	}
	spl, _ := sys["payload"].(map[string]any)
	if spl["status"] != "ok" || spl["extension"] != "postgres_changes" {
		t.Errorf("system payload mismatch: %v", spl)
	}
}

// TestHeartbeatReply: heartbeat → phx_reply{ok, response:{}} on phoenix topic.
func TestHeartbeatReply(t *testing.T) {
	conn, _, done := dialBroker(t, "")
	defer done()

	writeJSON(t, conn, map[string]any{
		"topic": "phoenix", "event": "heartbeat",
		"payload": map[string]any{}, "ref": "42",
	})
	reply := readJSON(t, conn)
	if reply["topic"] != "phoenix" || reply["event"] != "phx_reply" {
		t.Fatalf("bad heartbeat reply: %v", reply)
	}
	if reply["ref"] != "42" {
		t.Errorf("ref echo wrong: %v", reply["ref"])
	}
	pl, _ := reply["payload"].(map[string]any)
	if pl["status"] != "ok" {
		t.Errorf("status: %v", pl["status"])
	}
	if _, ok := pl["response"].(map[string]any); !ok {
		t.Errorf("response should be object, got %T %v", pl["response"], pl["response"])
	}
}

// TestServerBroadcastShape: events pushed to the broadcaster reach the
// joined client as `{"event":"broadcast","payload":{"type":"broadcast",
// "event":"profiler-event","payload":<event>}, "ref":null, "join_ref":null}`.
func TestServerBroadcastShape(t *testing.T) {
	conn, bus, done := dialBroker(t, "")
	defer done()

	writeJSON(t, conn, map[string]any{
		"topic": "realtime:drift", "event": "phx_join",
		"ref": "1", "join_ref": "1", "payload": joinPayload("k"),
	})
	// drain post-join trio
	for i := 0; i < 3; i++ {
		readJSON(t, conn)
	}

	bus.Push([]byte(`{"type":"wall_trace","service":"svc","count":1}`))

	frame := readJSON(t, conn)
	if frame["event"] != "broadcast" {
		t.Fatalf("expected broadcast, got %v", frame["event"])
	}
	if frame["topic"] != "realtime:drift" {
		t.Errorf("topic: %v", frame["topic"])
	}
	// ref / join_ref must be literal null on server-initiated broadcasts.
	if v, ok := frame["ref"]; !ok || v != nil {
		t.Errorf("ref should be null, got %#v", v)
	}
	if v, ok := frame["join_ref"]; !ok || v != nil {
		t.Errorf("join_ref should be null, got %#v", v)
	}
	pl, _ := frame["payload"].(map[string]any)
	if pl["type"] != "broadcast" || pl["event"] != "profiler-event" {
		t.Errorf("payload shape wrong: %v", pl)
	}
	inner, _ := pl["payload"].(map[string]any)
	if inner["type"] != "wall_trace" || inner["service"] != "svc" {
		t.Errorf("inner payload not roundtripped: %v", inner)
	}
}

// TestPublishOverWS: a client sends a broadcast envelope and (a)
// receives phx_reply{ok} for its ref and (b) peer subscribers receive
// the broadcast. Mirrors Supabase's broadcast ack=true behavior.
func TestPublishOverWS(t *testing.T) {
	pub, _, donePub := dialBroker(t, "")
	defer donePub()
	sub, _, doneSub := dialBroker(t, "")
	defer doneSub()

	// In httptest.NewServer each call gives a new server bus —
	// publisher and subscriber must share one broker. Spin up our own.
	bus := events.New(100)
	srv := httptest.NewServer(PhoenixHandler(bus, nil, nil))
	defer srv.Close()

	// Re-dial both against the shared server.
	_ = pub.Close(websocket.StatusNormalClosure, "")
	_ = sub.Close(websocket.StatusNormalClosure, "")

	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pub2, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	if err != nil {
		t.Fatalf("dial pub: %v", err)
	}
	defer pub2.Close(websocket.StatusNormalClosure, "")
	sub2, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	if err != nil {
		t.Fatalf("dial sub: %v", err)
	}
	defer sub2.Close(websocket.StatusNormalClosure, "")

	// Subscriber joins first so the published frame fans out to it.
	writeJSON(t, sub2, map[string]any{
		"topic": "realtime:drift", "event": "phx_join",
		"ref": "1", "join_ref": "1", "payload": joinPayload("subkey"),
	})
	for i := 0; i < 3; i++ {
		readJSON(t, sub2)
	}

	writeJSON(t, pub2, map[string]any{
		"topic": "realtime:drift", "event": "phx_join",
		"ref": "1", "join_ref": "1", "payload": joinPayload("pubkey"),
	})
	for i := 0; i < 3; i++ {
		readJSON(t, pub2)
	}

	writeJSON(t, pub2, map[string]any{
		"topic": "realtime:drift", "event": "broadcast",
		"ref": "9", "join_ref": "1",
		"payload": map[string]any{
			"type": "broadcast", "event": "profiler-event",
			"payload": map[string]any{"type": "wall_trace", "x": 1},
		},
	})

	// Publisher gets phx_reply{ok, ref:9}.
	ack := readJSON(t, pub2)
	if ack["event"] != "phx_reply" || ack["ref"] != "9" {
		t.Fatalf("publisher ack wrong: %v", ack)
	}
	apl, _ := ack["payload"].(map[string]any)
	if apl["status"] != "ok" {
		t.Errorf("ack status: %v", apl["status"])
	}

	// Subscriber receives the broadcast.
	frame := readJSON(t, sub2)
	if frame["event"] != "broadcast" {
		t.Fatalf("subscriber should get broadcast, got %v", frame["event"])
	}
	pl, _ := frame["payload"].(map[string]any)
	inner, _ := pl["payload"].(map[string]any)
	if inner["type"] != "wall_trace" || fmt.Sprint(inner["x"]) != "1" {
		t.Errorf("inner payload mismatch: %v", inner)
	}
}

// TestLeaveDropsSubscription: after phx_leave, no further broadcasts
// reach this client.
func TestLeaveDropsSubscription(t *testing.T) {
	conn, bus, done := dialBroker(t, "")
	defer done()

	writeJSON(t, conn, map[string]any{
		"topic": "realtime:drift", "event": "phx_join",
		"ref": "1", "join_ref": "1", "payload": joinPayload("k"),
	})
	for i := 0; i < 3; i++ {
		readJSON(t, conn)
	}

	writeJSON(t, conn, map[string]any{
		"topic": "realtime:drift", "event": "phx_leave",
		"ref": "2", "join_ref": "1", "payload": map[string]any{},
	})
	leaveReply := readJSON(t, conn)
	if leaveReply["event"] != "phx_reply" || leaveReply["ref"] != "2" {
		t.Fatalf("leave reply wrong: %v", leaveReply)
	}

	// Push an event; nothing should be deliverable.
	bus.Push([]byte(`{"type":"wall_trace"}`))
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if err == nil {
		t.Fatalf("expected no further frames after leave, got one")
	}
}

// TestApikeyAcceptedAndIgnored: any apikey value is accepted; absence
// is also accepted (local dev / mock).
func TestApikeyAcceptedAndIgnored(t *testing.T) {
	for _, q := range []string{"", "apikey=", "apikey=junk", "apikey=eyJhbGciOiJIUzI1NiJ9.junk.sig&vsn=1.0.0"} {
		conn, _, done := dialBroker(t, q)
		// Just verify the WS handshake worked; close immediately.
		_ = conn.Close(websocket.StatusNormalClosure, "")
		done()
	}
	// Sanity: the test would have already t.Fatal'd in dialBroker on a
	// handshake error — reaching here means every variant succeeded.
}

// Static import of http to satisfy the unused-import linter on
// platforms where the http package would otherwise drop out.
var _ = http.StatusOK
