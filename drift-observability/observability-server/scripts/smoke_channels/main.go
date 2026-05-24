// Channel-bus smoke client. Joins one channel, POSTs an event, then
// reads /channels/messages and /channels back. Exits non-zero on any
// missing piece. Run it inside the same Docker image that built the
// server so the cgo/websocket deps are in scope.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/coder/websocket"
)

func main() {
	base := "http://localhost:8080"
	wsURL := "ws://localhost:8080/realtime/v1/websocket?apikey=k&vsn=1.0.0"
	if v := os.Getenv("BASE"); v != "" {
		base = v
	}
	if v := os.Getenv("WS"); v != "" {
		wsURL = v
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Open WS, join channel.
	conn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	must("dial", err)
	defer conn.Close(websocket.StatusNormalClosure, "")
	join := `{"topic":"realtime:drift-profiler-events","event":"phx_join","ref":"1","join_ref":"1","payload":{}}`
	must("send join", conn.Write(ctx, websocket.MessageText, []byte(join)))

	// Drain the join trio (phx_reply, presence_state, system).
	for i := 0; i < 3; i++ {
		_, _, err := conn.Read(ctx)
		must(fmt.Sprintf("read post-join %d", i), err)
	}

	// 2. POST an event.
	event := `{"type":"wall_trace","time":"2026-05-21T00:00:00Z","service":"svc","pod":"p","period_ns":1,"duration_ns":1,"cpu":0,"memory_bytes":0,"count":1,"frames":[{"name":"f","file":"a.py","line":1}]}`
	rsp, err := http.Post(base+"/events", "application/json", bytes.NewReader([]byte(event)))
	must("POST /events", err)
	body, _ := io.ReadAll(rsp.Body)
	rsp.Body.Close()
	if rsp.StatusCode != 202 {
		bail("POST /events status %d: %s", rsp.StatusCode, body)
	}

	// 3. Wait for the broadcast to land at the WS client (proves the
	//    server actually wrote the broadcast envelope, which is what
	//    the channel bus tees).
	conn.SetReadLimit(1 << 20)
	rctx, rcancel := context.WithTimeout(ctx, 3*time.Second)
	defer rcancel()
	_, broadcastBytes, err := conn.Read(rctx)
	must("read broadcast", err)
	var env map[string]any
	must("decode broadcast", json.Unmarshal(broadcastBytes, &env))
	if env["event"] != "broadcast" {
		bail("expected broadcast envelope, got %v", env)
	}

	// 4. /channels should show our subscription.
	rsp, err = http.Get(base + "/channels")
	must("GET /channels", err)
	body, _ = io.ReadAll(rsp.Body)
	rsp.Body.Close()
	var topics map[string]int
	must("decode /channels", json.Unmarshal(body, &topics))
	if topics["realtime:drift-profiler-events"] < 1 {
		bail("/channels missing our topic: %s", body)
	}
	fmt.Printf("/channels = %s\n", body)

	// 5. /channels/messages?topic=… should include phx_join (in),
	//    phx_reply (out), presence_state (out), system (out),
	//    broadcast (out).
	rsp, err = http.Get(base + "/channels/messages?topic=realtime:drift-profiler-events")
	must("GET /channels/messages", err)
	body, _ = io.ReadAll(rsp.Body)
	rsp.Body.Close()
	var frames []map[string]any
	must("decode /channels/messages", json.Unmarshal(body, &frames))
	want := map[string]bool{
		"in:phx_join":         false,
		"out:phx_reply":       false,
		"out:presence_state":  false,
		"out:system":          false,
		"out:broadcast":       false,
	}
	for _, f := range frames {
		k := fmt.Sprintf("%v:%v", f["direction"], f["event"])
		if _, ok := want[k]; ok {
			want[k] = true
		}
	}
	for k, seen := range want {
		if !seen {
			bail("/channels/messages missing %q (got %d frames)", k, len(frames))
		}
	}
	fmt.Printf("/channels/messages: %d frames; saw %v\n", len(frames), want)
	fmt.Println("PASS")
}

func must(label string, err error) {
	if err != nil {
		bail("%s: %v", label, err)
	}
}

func bail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "FAIL: "+format+"\n", args...)
	os.Exit(1)
}
