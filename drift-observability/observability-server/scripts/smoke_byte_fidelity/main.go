package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/coder/websocket"
)

func main() {
	base := os.Getenv("BASE")
	wsURL := os.Getenv("WS")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{Subprotocols: []string{"phoenix"}})
	if err != nil {
		fmt.Println("dial:", err)
		os.Exit(1)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	join := `{"topic":"realtime:drift-profiler-events","event":"phx_join","ref":"1","join_ref":"1","payload":{}}`
	conn.Write(ctx, websocket.MessageText, []byte(join))
	for i := 0; i < 3; i++ {
		conn.Read(ctx)
	}

	// Event with HTML-meta chars in a string field.
	event := `{"type":"wall_trace","service":"<a&b>","note":"x<y>&z"}`
	http.Post(base+"/events", "application/json", strings.NewReader(event))

	// Read broadcast.
	rctx, _ := context.WithTimeout(ctx, 3*time.Second)
	_, payload, err := conn.Read(rctx)
	if err != nil {
		fmt.Println("read broadcast:", err)
		os.Exit(1)
	}

	// Get snapshot.
	rsp, _ := http.Get(base + "/channels/messages?topic=realtime:drift-profiler-events")
	defer rsp.Body.Close()
	body, _ := io.ReadAll(rsp.Body)

	// Find an out:broadcast frame — pick the latest (the ring may
	// contain leftovers from earlier smoke runs against the same
	// container).
	var frames []struct {
		Direction string          `json:"direction"`
		Event     string          `json:"event"`
		Frame     json.RawMessage `json:"frame"`
	}
	json.Unmarshal(body, &frames)
	var bc []byte
	for _, f := range frames {
		if f.Direction == "out" && f.Event == "broadcast" {
			bc = f.Frame
		}
	}
	if bc == nil {
		fmt.Println("no broadcast frame in snapshot")
		os.Exit(1)
	}

	// The bytes in `bc` should match `payload` exactly (both are the
	// outbound broadcast envelope the server sent).
	if bytes.Equal(bc, payload) {
		fmt.Println("OK: snapshot byte-identical to WS payload")
	} else {
		fmt.Println("MISMATCH")
		fmt.Println("  ws payload :", string(payload))
		fmt.Println("  snapshot   :", string(bc))
		os.Exit(1)
	}

	// The 6-byte sequence < is what Go's default JSON encoder
	// emits for the single byte '<' (and > / & for '>' / '&').
	// Finding any of them in the broker output would prove that an
	// outbound encode site forgot to call SetEscapeHTML(false). The
	// literal `<a&b>` we POSTed should arrive intact instead.
	if bytes.Contains(bc, []byte("\\u003c")) ||
		bytes.Contains(bc, []byte("\\u003e")) ||
		bytes.Contains(bc, []byte("\\u0026")) {
		fmt.Println("FAIL: snapshot was HTML-escaped:", string(bc))
		os.Exit(1)
	}
	if !bytes.Contains(bc, []byte(`<a&b>`)) {
		fmt.Println("FAIL: snapshot doesn't contain literal <a&b>:", string(bc))
		os.Exit(1)
	}
	fmt.Println("OK: literal <, &, > preserved in snapshot")
}
