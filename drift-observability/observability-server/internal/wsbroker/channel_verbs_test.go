// channel_verbs_test covers the HTTP publish/subscribe verbs reaching
// the SAME pubsub bus the WS broker uses — so a POST publish reaches
// both an HTTP /channels/subscribe listener AND a WS phx_join'd
// client. Lives in the wsbroker package because it needs the full
// stack (Mux + WS + Bus) wired together.
package wsbroker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/company/drift-observability/observability-server/internal/events"
	"github.com/company/drift-observability/observability-server/internal/pubsub"
)

// minMux builds just enough mux for these tests without dragging the
// full `internal/api` package (which would create an import cycle).
// We hand-roll the same routes the production Mux registers for the
// pubsub paths.
func minMux(b *events.Broadcaster, bus *pubsub.Bus, cb *ChannelBus) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /realtime/v1/websocket", PhoenixHandler(b, bus, cb))
	mux.HandleFunc("POST /channels/publish", func(w http.ResponseWriter, r *http.Request) {
		topic := r.URL.Query().Get("topic")
		body, _ := io.ReadAll(r.Body)
		bus.Publish(topic, bytes.TrimSpace(body))
		w.WriteHeader(http.StatusAccepted)
		_, _ = fmt.Fprintf(w, `{"accepted":1,"subscribers":%d}`, bus.SubscriberCount(topic))
	})
	mux.HandleFunc("GET /channels/subscribe", func(w http.ResponseWriter, r *http.Request) {
		flusher, _ := w.(http.Flusher)
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()
		ch, cancel := bus.Subscribe(r.URL.Query().Get("topic"))
		defer cancel()
		for {
			select {
			case <-r.Context().Done():
				return
			case p, ok := <-ch:
				if !ok {
					return
				}
				_, _ = w.Write([]byte("data: "))
				_, _ = w.Write(p)
				_, _ = w.Write([]byte("\n\n"))
				flusher.Flush()
			}
		}
	})
	return mux
}

func TestHTTPPublishReachesWSAndHTTPSubscriber(t *testing.T) {
	b := events.New(100)
	bus := pubsub.New(50)
	srv := httptest.NewServer(minMux(b, bus, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1) WS subscriber joins.
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	wsConn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer wsConn.Close(websocket.StatusNormalClosure, "")
	join := `{"topic":"realtime:foo","event":"phx_join","ref":"1","join_ref":"1","payload":{}}`
	if err := wsConn.Write(ctx, websocket.MessageText, []byte(join)); err != nil {
		t.Fatalf("send join: %v", err)
	}
	// Drain post-join trio.
	for i := 0; i < 3; i++ {
		if _, _, err := wsConn.Read(ctx); err != nil {
			t.Fatalf("drain post-join[%d]: %v", i, err)
		}
	}

	// 2) HTTP subscriber opens an SSE stream.
	req, _ := http.NewRequestWithContext(ctx, "GET", srv.URL+"/channels/subscribe?topic=realtime:foo", nil)
	sseRsp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("sse get: %v", err)
	}
	defer sseRsp.Body.Close()
	// Give the SSE handler a moment to actually Subscribe (the request
	// is handled in a goroutine; we don't see "subscribed" until the
	// handler runs).
	if !waitFor(t, func() bool { return bus.SubscriberCount("realtime:foo") >= 1 }, time.Second) {
		t.Fatal("HTTP subscriber didn't register")
	}

	// 3) Publish a payload via HTTP.
	payload := `{"hello":"world"}`
	pubRsp, err := http.Post(srv.URL+"/channels/publish?topic=realtime:foo",
		"application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("publish: %v", err)
	}
	pubRsp.Body.Close()
	if pubRsp.StatusCode != 202 {
		t.Fatalf("publish status = %d", pubRsp.StatusCode)
	}

	// 4) Both subscribers should receive the payload.
	// 4a) WS subscriber gets a Phoenix broadcast envelope.
	rctx, rcancel := context.WithTimeout(ctx, 3*time.Second)
	defer rcancel()
	_, frameBytes, err := wsConn.Read(rctx)
	if err != nil {
		t.Fatalf("ws read: %v", err)
	}
	var env map[string]any
	if err := json.Unmarshal(frameBytes, &env); err != nil {
		t.Fatalf("decode WS frame: %v", err)
	}
	if env["event"] != "broadcast" {
		t.Fatalf("WS got non-broadcast frame: %v", env)
	}
	pp, _ := env["payload"].(map[string]any)
	inner, _ := pp["payload"].(map[string]any)
	if inner["hello"] != "world" {
		t.Fatalf("WS payload mismatch: %v", inner)
	}

	// 4b) HTTP SSE subscriber gets the bare payload.
	got := readOneSSEData(t, sseRsp.Body, 3*time.Second)
	if got != payload {
		t.Fatalf("SSE got %q, want %q", got, payload)
	}
}

func TestWSBroadcastReachesHTTPSubscriber(t *testing.T) {
	b := events.New(100)
	bus := pubsub.New(50)
	srv := httptest.NewServer(minMux(b, bus, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// HTTP subscriber first.
	req, _ := http.NewRequestWithContext(ctx, "GET", srv.URL+"/channels/subscribe?topic=realtime:foo", nil)
	sseRsp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("sse get: %v", err)
	}
	defer sseRsp.Body.Close()
	if !waitFor(t, func() bool { return bus.SubscriberCount("realtime:foo") >= 1 }, time.Second) {
		t.Fatal("HTTP subscriber didn't register")
	}

	// WS publisher joins (handleFrame's broadcast branch publishes to
	// pubsub) and sends a broadcast.
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	wsConn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer wsConn.Close(websocket.StatusNormalClosure, "")
	join := `{"topic":"realtime:foo","event":"phx_join","ref":"1","join_ref":"1","payload":{}}`
	_ = wsConn.Write(ctx, websocket.MessageText, []byte(join))
	for i := 0; i < 3; i++ {
		_, _, _ = wsConn.Read(ctx)
	}
	bc := `{"topic":"realtime:foo","event":"broadcast","ref":"2","join_ref":"1","payload":{"event":"profiler-event","payload":{"v":42}}}`
	if err := wsConn.Write(ctx, websocket.MessageText, []byte(bc)); err != nil {
		t.Fatalf("ws broadcast: %v", err)
	}

	got := readOneSSEData(t, sseRsp.Body, 3*time.Second)
	if !strings.Contains(got, `"v":42`) {
		t.Fatalf("HTTP subscriber didn't receive WS broadcast: %q", got)
	}
}

// readOneSSEData reads the body until it finds a `data: …\n\n` block
// and returns the payload (without `data: ` prefix or trailing
// newlines). Skips comment lines (`: …`).
func readOneSSEData(t *testing.T, r io.Reader, timeout time.Duration) string {
	t.Helper()
	type chunk struct {
		s   string
		err error
	}
	done := make(chan chunk, 1)
	go func() {
		buf := make([]byte, 0, 1024)
		tmp := make([]byte, 256)
		for {
			n, err := r.Read(tmp)
			if n > 0 {
				buf = append(buf, tmp[:n]...)
				if idx := bytes.Index(buf, []byte("\n\n")); idx >= 0 {
					block := string(buf[:idx])
					for _, line := range strings.Split(block, "\n") {
						if strings.HasPrefix(line, "data: ") {
							done <- chunk{s: strings.TrimPrefix(line, "data: ")}
							return
						}
					}
					// No data: line in this block — keep reading.
					buf = buf[idx+2:]
				}
			}
			if err != nil {
				done <- chunk{err: err}
				return
			}
		}
	}()
	select {
	case c := <-done:
		if c.err != nil {
			t.Fatalf("sse read: %v", c.err)
		}
		return c.s
	case <-time.After(timeout):
		t.Fatal("timeout waiting for SSE data")
		return ""
	}
}

func waitFor(t *testing.T, cond func() bool, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return false
}
