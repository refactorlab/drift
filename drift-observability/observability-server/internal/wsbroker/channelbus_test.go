// channelbus_test covers the per-topic frame tap that powers
// /channels/* HTTP endpoints. The tests use the same real-WebSocket
// dial pattern as wsbroker_test so we exercise the actual write/read
// path the broker takes in production — no internal-only hooks.
package wsbroker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/company/drift-observability/observability-server/internal/events"
)

// readUntil reads frames from `sub` and routes them to `pred`,
// returning the first frame for which pred returns true or failing
// the test on timeout.
func readChannelFrameUntil(t *testing.T, ch <-chan Frame, timeout time.Duration, pred func(Frame) bool) Frame {
	t.Helper()
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	for {
		select {
		case f, ok := <-ch:
			if !ok {
				t.Fatalf("channel closed before predicate matched")
			}
			if pred(f) {
				return f
			}
		case <-deadline.C:
			t.Fatalf("timed out waiting for matching frame")
		}
	}
}

func TestChannelBusCapturesJoinReplyAndBroadcast(t *testing.T) {
	bus := events.New(100)
	cb := NewChannelBus(100)
	srv := httptest.NewServer(PhoenixHandler(bus, nil, cb))
	defer srv.Close()

	subFrames, cancel := cb.Subscribe("")
	defer cancel()

	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	ctx, ctxCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer ctxCancel()
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		Subprotocols: []string{"phoenix"},
	})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// 1. Client joins. ChannelBus should observe inbound phx_join AND
	//    outbound phx_reply/presence_state/system (the post-join trio).
	join := `{"topic":"realtime:test","event":"phx_join","ref":"1","join_ref":"1","payload":{}}`
	if err := conn.Write(ctx, websocket.MessageText, []byte(join)); err != nil {
		t.Fatalf("write join: %v", err)
	}

	wantInbound := readChannelFrameUntil(t, subFrames, 2*time.Second, func(f Frame) bool {
		return f.Direction == DirectionIn && f.Event == "phx_join"
	})
	if wantInbound.Topic != "realtime:test" {
		t.Fatalf("inbound phx_join topic = %q, want %q", wantInbound.Topic, "realtime:test")
	}

	gotReply := readChannelFrameUntil(t, subFrames, 2*time.Second, func(f Frame) bool {
		return f.Direction == DirectionOut && f.Event == "phx_reply"
	})
	// Outbound frame must be valid JSON and carry the right ref.
	var env map[string]any
	if err := json.Unmarshal(gotReply.Frame, &env); err != nil {
		t.Fatalf("phx_reply not valid JSON: %v", err)
	}
	if env["topic"] != "realtime:test" {
		t.Fatalf("phx_reply topic = %v, want %q", env["topic"], "realtime:test")
	}

	// 2. Server-side broadcast. We expect the bus to see an outbound
	//    broadcast envelope on the joined topic.
	bus.Push([]byte(`{"type":"wall_trace","service":"svc"}`))

	gotBroadcast := readChannelFrameUntil(t, subFrames, 2*time.Second, func(f Frame) bool {
		return f.Direction == DirectionOut && f.Event == "broadcast"
	})
	if gotBroadcast.Topic != "realtime:test" {
		t.Fatalf("broadcast topic = %q, want %q", gotBroadcast.Topic, "realtime:test")
	}
	// Body must be a Supabase-shape broadcast envelope.
	if err := json.Unmarshal(gotBroadcast.Frame, &env); err != nil {
		t.Fatalf("broadcast envelope not valid JSON: %v", err)
	}
	if env["event"] != "broadcast" {
		t.Fatalf("envelope.event = %v, want broadcast", env["event"])
	}
}

func TestChannelBusTopicFilter(t *testing.T) {
	bus := events.New(100)
	cb := NewChannelBus(100)
	srv := httptest.NewServer(PhoenixHandler(bus, nil, cb))
	defer srv.Close()

	// Filter to ONE channel.
	subFrames, cancel := cb.Subscribe("realtime:wanted")
	defer cancel()

	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	ctx, ctxCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer ctxCancel()
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		Subprotocols: []string{"phoenix"},
	})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Join two channels — the filter should only deliver frames for
	// "wanted".
	for i, topic := range []string{"realtime:other", "realtime:wanted"} {
		j := fmt.Sprintf(`{"topic":%q,"event":"phx_join","ref":"%d","join_ref":"%d","payload":{}}`, topic, i+1, i+1)
		if err := conn.Write(ctx, websocket.MessageText, []byte(j)); err != nil {
			t.Fatalf("write join %s: %v", topic, err)
		}
	}

	// Collect every frame the filter delivers within a short window.
	deadline := time.NewTimer(800 * time.Millisecond)
	defer deadline.Stop()
	seen := []string{}
collect:
	for {
		select {
		case f, ok := <-subFrames:
			if !ok {
				break collect
			}
			if f.Topic != "realtime:wanted" {
				t.Fatalf("filter leak: topic %q delivered to wanted-only subscriber", f.Topic)
			}
			seen = append(seen, string(f.Direction)+":"+f.Event)
		case <-deadline.C:
			break collect
		}
	}
	// Sanity: we must have seen at least the join + reply for the
	// wanted channel.
	if len(seen) < 2 {
		t.Fatalf("expected at least join+reply frames on wanted topic, got %v", seen)
	}
}

func TestChannelBusJoinedLeftCounters(t *testing.T) {
	bus := events.New(100)
	cb := NewChannelBus(100)
	srv := httptest.NewServer(PhoenixHandler(bus, nil, cb))
	defer srv.Close()

	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime/v1/websocket"
	ctx, ctxCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer ctxCancel()

	// Two clients join the same topic.
	var conns []*websocket.Conn
	for i := 0; i < 2; i++ {
		c, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{
			Subprotocols: []string{"phoenix"},
		})
		if err != nil {
			t.Fatalf("dial #%d: %v", i, err)
		}
		conns = append(conns, c)
		j := fmt.Sprintf(`{"topic":"realtime:shared","event":"phx_join","ref":"%d","join_ref":"%d","payload":{}}`, i+1, i+1)
		if err := c.Write(ctx, websocket.MessageText, []byte(j)); err != nil {
			t.Fatalf("write join #%d: %v", i, err)
		}
	}

	// Topics() should converge to {"realtime:shared": 2}. Poll briefly
	// since the broker handles the join in a goroutine.
	if !waitForTopic(t, cb, "realtime:shared", 2, time.Second) {
		t.Fatalf("expected 2 subscribers on realtime:shared, got %v", cb.Topics())
	}

	// First client leaves cleanly.
	leave := `{"topic":"realtime:shared","event":"phx_leave","ref":"99","join_ref":"1","payload":{}}`
	if err := conns[0].Write(ctx, websocket.MessageText, []byte(leave)); err != nil {
		t.Fatalf("write leave: %v", err)
	}
	if !waitForTopic(t, cb, "realtime:shared", 1, time.Second) {
		t.Fatalf("after leave, expected 1 subscriber, got %v", cb.Topics())
	}

	// Second client disconnects without phx_leave — cleanupJoinedTopics
	// must still drop the counter to zero.
	_ = conns[1].Close(websocket.StatusNormalClosure, "")
	if !waitForTopic(t, cb, "realtime:shared", 0, time.Second) {
		t.Fatalf("after disconnect, expected topic removed, got %v", cb.Topics())
	}
}

// waitForTopic polls cb.Topics() until the target topic has the
// expected count (or is removed when `want == 0`). Returns false on
// timeout.
func waitForTopic(t *testing.T, cb *ChannelBus, topic string, want int, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		got := cb.Topics()[topic]
		if want == 0 {
			if _, present := cb.Topics()[topic]; !present {
				return true
			}
		} else if got == want {
			return true
		}
		time.Sleep(20 * time.Millisecond)
	}
	return false
}

func TestChannelBusSlowSubscriberDoesNotBlockPublisher(t *testing.T) {
	cb := NewChannelBus(10)
	// Don't read from this subscriber — it will quickly overflow its
	// 256-frame buffer. The publisher must keep making progress
	// regardless.
	_, cancel := cb.Subscribe("")
	defer cancel()

	// Publish more than the subscriber's buffer. If Publish blocks,
	// this loop never returns.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 5_000; i++ {
			cb.Publish(Frame{
				Topic: "realtime:flood",
				Event: "broadcast",
				Frame: json.RawMessage(`{}`),
			})
		}
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("Publish blocked on slow subscriber")
	}
}

// Ensure ChannelBus.Snapshot is safe under concurrent Publish calls —
// the ring/lock implementation has obvious failure modes if mu isn't
// held everywhere.
func TestChannelBusConcurrentPublishAndSnapshot(t *testing.T) {
	cb := NewChannelBus(50)
	var wg sync.WaitGroup
	stop := make(chan struct{})
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for n := 0; ; n++ {
				select {
				case <-stop:
					return
				default:
				}
				cb.Publish(Frame{
					Topic: fmt.Sprintf("realtime:t%d", id),
					Event: "broadcast",
					Frame: json.RawMessage(`{}`),
				})
				if n%50 == 0 {
					_ = cb.Snapshot("")
				}
			}
		}(i)
	}
	time.Sleep(150 * time.Millisecond)
	close(stop)
	wg.Wait()
	// If we got here without -race firing or deadlocking we're good.
	if got := len(cb.Snapshot("")); got == 0 {
		t.Fatalf("expected non-empty ring after concurrent publish")
	}
}
