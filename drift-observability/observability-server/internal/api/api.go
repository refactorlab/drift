// Package api wires HTTP handlers to a Broadcaster.
package api

import (
	"bufio"
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/company/drift-observability/observability-server/internal/events"
	"github.com/company/drift-observability/observability-server/internal/ingest"
	"github.com/company/drift-observability/observability-server/internal/pubsub"
	"github.com/company/drift-observability/observability-server/internal/wsbroker"
)

//go:embed all:web
var webFS embed.FS

// Mux returns the HTTP handler for the observability-server.
//
// `writer` is the ingest sink for POST endpoints; `tracePath` is read by
// the GET history endpoints. They should refer to the same file so
// posted events show up on history reads. Pass `nil` for `writer` to
// disable ingest endpoints (tailer-only deployments).
//
// `bus` is the per-topic pubsub layer used by the channel verbs
// (POST /channels/publish, GET /channels/subscribe). Pass `nil` to
// disable those endpoints.
//
// `channelBus` powers the `/channels/messages` and `/channels/live`
// debug endpoints (per-topic live view of Phoenix wire frames). Pass
// `nil` to disable.
func Mux(b *events.Broadcaster, writer *ingest.Writer, tracePath string, bus *pubsub.Bus, channelBus *wsbroker.ChannelBus) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /live_logs", liveLogsHandler(b))
	mux.HandleFunc("GET /events", eventsHandler(b))
	mux.HandleFunc("GET /events/all", allEventsHandler(tracePath))
	// `/events/log` returns the on-disk JSONL file verbatim — one event
	// per line, no array wrapping. Desktop / pprof-style tools download
	// this and replay it locally.
	mux.HandleFunc("GET /events/log", eventsLogHandler(tracePath))

	if writer != nil {
		// POST ingest. Each accepted event lands in the trace file; the
		// tailer (running in the background) picks it up and broadcasts
		// to live subscribers — so there's exactly one fanout path
		// regardless of whether the event came from a file writer or
		// over the wire.
		mux.HandleFunc("POST /events", postEventHandler(writer))
		mux.HandleFunc("POST /events/bulk", postBulkEventsHandler(writer))
	}

	// Phoenix-Channels-emulating WebSocket — lets the desktop UI's
	// Supabase Realtime client subscribe directly to this server in
	// place of (or alongside) Supabase. See internal/wsbroker.
	mux.HandleFunc("GET /realtime/v1/websocket", wsbroker.PhoenixHandler(b, bus, channelBus))

	if bus != nil {
		// Channel verbs — the HTTP-side equivalents of Phoenix
		// `broadcast` / `phx_join`. Lets any HTTP client publish to or
		// subscribe to a channel without speaking the WebSocket
		// protocol. Both this server's WS sessions and other HTTP
		// subscribers receive what's published here.
		mux.HandleFunc("POST /channels/publish", channelsPublishHandler(bus, writer))
		mux.HandleFunc("GET /channels/subscribe", channelsSubscribeHandler(bus))
	}

	if channelBus != nil {
		// Channel-level introspection — the wire-shape sibling of
		// /events. Lets operators watch the actual Phoenix envelopes
		// flowing through a given channel without opening a WS client.
		mux.HandleFunc("GET /channels", channelsListHandler(channelBus, bus))
		mux.HandleFunc("GET /channels/messages", channelsMessagesHandler(channelBus))
		mux.HandleFunc("GET /channels/live", channelsLiveHandler(channelBus))
	}

	// Static assets
	subFS, _ := fs.Sub(webFS, "web")
	mux.HandleFunc("GET /docs", redirect("/docs/"))
	mux.HandleFunc("GET /docs/", serveFile(subFS, "docs.html"))
	mux.HandleFunc("GET /live", serveFile(subFS, "live.html"))
	mux.HandleFunc("GET /openapi.yaml", serveFile(subFS, "openapi.yaml"))
	mux.HandleFunc("GET /", redirect("/docs/"))

	return mux
}

// --- handlers ---------------------------------------------------------------

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

// liveLogsHandler streams the broadcaster's output over Server-Sent Events.
func liveLogsHandler(b *events.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		ch, cancel := b.Subscribe()
		defer cancel()

		keepalive := time.NewTicker(15 * time.Second)
		defer keepalive.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-keepalive.C:
				_, _ = w.Write([]byte(": ka\n\n"))
				flusher.Flush()
			case line, ok := <-ch:
				if !ok {
					return
				}
				_, _ = w.Write([]byte("data: "))
				_, _ = w.Write(line)
				_, _ = w.Write([]byte("\n\n"))
				flusher.Flush()
			}
		}
	}
}

// eventsHandler returns the broadcaster's history as a JSON array.
func eventsHandler(b *events.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		lines := b.Snapshot()
		_, _ = w.Write([]byte("["))
		for i, line := range lines {
			if i > 0 {
				_, _ = w.Write([]byte(","))
			}
			_, _ = w.Write(line)
		}
		_, _ = w.Write([]byte("]"))
	}
}

// allEventsHandler streams every line of the on-disk trace file as a JSON array.
// Each line in the file is one JSON event; we concatenate them with commas
// without parsing, so output stays a single valid JSON array. If the file
// doesn't exist yet (no events have been written), we return an empty array.
func allEventsHandler(tracePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		f, err := os.Open(tracePath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte("[]"))
				return
			}
			http.Error(w, "failed to open events file", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		w.Header().Set("Content-Type", "application/json")
		scanner := bufio.NewScanner(f)
		// Allow long single-line events; ring buffer in drift can produce
		// payloads larger than the default 64KiB scanner cap.
		scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)

		_, _ = w.Write([]byte("["))
		first := true
		for scanner.Scan() {
			line := bytes.TrimSpace(scanner.Bytes())
			if len(line) == 0 {
				continue
			}
			if !first {
				_, _ = w.Write([]byte(","))
			}
			_, _ = w.Write(line)
			first = false
		}
		_, _ = w.Write([]byte("]"))
	}
}

// eventsLogHandler streams the on-disk events JSONL file verbatim.
//
// Unlike `/events/all` (which wraps the lines in `[…]` for clients that
// want a single JSON document), this endpoint preserves the original
// JSONL: one JSON object per `\n`-terminated line, no commas, no array
// brackets. That's the format the desktop UI's event_log aggregator
// expects and the format every tail-oriented tool (jq -c, awk, etc.)
// reads natively.
//
// Returns 404 with `[]`-like JSON (for backward-compatibility with
// /events/all consumers) when the file doesn't exist yet, and a
// Content-Disposition header so browsers offer a "save as" dialog
// rather than rendering the bytes inline.
func eventsLogHandler(tracePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		f, err := os.Open(tracePath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				// Empty JSONL stream is the empty document.
				w.Header().Set("Content-Type", "application/x-ndjson")
				return
			}
			http.Error(w, "failed to open events file", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		// application/x-ndjson is the conventional MIME for newline-
		// delimited JSON. Suggesting a download with a stable filename
		// lets the desktop UI save it under a known name without
		// renaming dance.
		w.Header().Set("Content-Type", "application/x-ndjson")
		w.Header().Set("Content-Disposition", `attachment; filename="events.log"`)
		// Best-effort Content-Length — if Stat fails (race), let the
		// transfer be chunked.
		if st, errStat := f.Stat(); errStat == nil {
			w.Header().Set("Content-Length", strconv.FormatInt(st.Size(), 10))
		}
		// io.Copy handles backpressure and short writes; we copy the
		// raw bytes without parsing, so this scales to huge files.
		_, _ = io.Copy(w, f)
	}
}

// postEventHandler accepts a single JSON event in the request body. The
// body is parsed permissively: a bare JSON object is wrapped; a JSON
// array is iterated and each element appended; NDJSON (one object per
// line) is split. This lets a client POST whatever shape is convenient
// without negotiating a Content-Type up front.
func postEventHandler(w *ingest.Writer) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		body, err := io.ReadAll(http.MaxBytesReader(rw, r.Body, 8*1024*1024))
		if err != nil {
			http.Error(rw, "read body: "+err.Error(), http.StatusBadRequest)
			return
		}
		accepted, ferr := writeEventBody(w, body)
		if ferr != nil {
			// Distinguish client errors (malformed body) from server errors
			// (disk write failed). errBadRequest is the marker writeEventBody
			// uses for the former — anything else is a 500.
			status := http.StatusInternalServerError
			if errors.Is(ferr, errBadRequest) {
				status = http.StatusBadRequest
			}
			http.Error(rw, ferr.Error(), status)
			return
		}
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusAccepted)
		_, _ = fmt.Fprintf(rw, `{"accepted":%d}`, accepted)
	}
}

// errBadRequest sentinel — writeEventBody wraps it whenever the body
// shape itself is unparseable (vs a transient disk error).
var errBadRequest = errors.New("bad request")

// postBulkEventsHandler accepts NDJSON (one event per '\n'-terminated
// line). Identical semantics to /events when the body is NDJSON — the
// distinct endpoint exists so clients have an unambiguous Content-Type
// contract (`application/x-ndjson`) for batch uploads.
func postBulkEventsHandler(w *ingest.Writer) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		n, err := w.AppendNDJSON(http.MaxBytesReader(rw, r.Body, 64*1024*1024))
		if err != nil && !errors.Is(err, ingest.ErrEmpty) && !errors.Is(err, ingest.ErrInvalidJSON) {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusAccepted)
		_, _ = fmt.Fprintf(rw, `{"accepted":%d}`, n)
	}
}

// writeEventBody dispatches one HTTP body to the ingest writer.
// Handles three shapes transparently:
//   - bare object: `{...}`           → 1 line
//   - JSON array:  `[{...},{...}]`   → N lines
//   - NDJSON:      `{...}\n{...}\n…` → N lines
func writeEventBody(w *ingest.Writer, body []byte) (int, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return 0, nil
	}
	switch trimmed[0] {
	case '[':
		// JSON array — decode element-by-element to preserve large
		// nested objects without loading them all into one slice. A
		// malformed element is a client error (not a server failure):
		// wrap with errBadRequest so the handler returns 400.
		dec := newArrayDecoder(trimmed)
		accepted := 0
		for dec.more() {
			raw, derr := dec.next()
			if derr != nil {
				return accepted, fmt.Errorf("%w: %s", errBadRequest, derr.Error())
			}
			if _, werr := w.AppendLine(raw); werr != nil {
				if errors.Is(werr, ingest.ErrEmpty) || errors.Is(werr, ingest.ErrInvalidJSON) {
					continue
				}
				return accepted, werr
			}
			accepted++
		}
		return accepted, nil
	case '{':
		// Either one bare object or NDJSON. If a newline followed by a
		// `{` appears at top level, treat as NDJSON. (Inside JSON
		// strings, `\n` is escaped as `\\n`, so a literal LF+`{` only
		// appears as a real record separator.)
		if bytes.Contains(trimmed, []byte("\n{")) {
			return w.AppendNDJSON(bytes.NewReader(trimmed))
		}
		if _, err := w.AppendLine(trimmed); err != nil {
			// Empty/invalid JSON in a bare-object POST is a client
			// problem (they sent `{garbage}` not a real event). Return
			// errBadRequest so the handler maps it to 400 rather than
			// silently returning 0-accepted.
			if errors.Is(err, ingest.ErrEmpty) || errors.Is(err, ingest.ErrInvalidJSON) {
				return 0, fmt.Errorf("%w: %s", errBadRequest, err.Error())
			}
			return 0, err
		}
		return 1, nil
	default:
		return 0, fmt.Errorf("%w: body must be a JSON object, array, or NDJSON", errBadRequest)
	}
}

// --- channel verbs (publish / subscribe) ------------------------------------

// channelsPublishHandler accepts a JSON body and publishes it to the
// pubsub bus on `?topic=…`. Every subscriber of that topic — WS
// clients joined via phx_join AND HTTP clients listening on
// /channels/subscribe — receives the same payload.
//
// `?persist=1` ALSO appends the payload to the trace file (when an
// ingest writer is wired). Off by default — publish is in-memory by
// nature; consumers that want durable replay can opt in.
func channelsPublishHandler(bus *pubsub.Bus, writer *ingest.Writer) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		topic := r.URL.Query().Get("topic")
		if topic == "" {
			http.Error(rw, "topic query parameter is required", http.StatusBadRequest)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(rw, r.Body, 8*1024*1024))
		if err != nil {
			http.Error(rw, "read body: "+err.Error(), http.StatusBadRequest)
			return
		}
		trimmed := bytes.TrimSpace(body)
		if len(trimmed) == 0 {
			http.Error(rw, "body is empty", http.StatusBadRequest)
			return
		}
		if !json.Valid(trimmed) {
			http.Error(rw, "body must be a JSON value", http.StatusBadRequest)
			return
		}
		bus.Publish(topic, trimmed)
		if writer != nil && r.URL.Query().Get("persist") == "1" {
			// Best-effort durable record — failure shouldn't fail the
			// publish itself, only the persist hint.
			_, _ = writer.AppendLine(trimmed)
		}
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusAccepted)
		_, _ = fmt.Fprintf(rw, `{"accepted":1,"topic":%q,"subscribers":%d}`,
			topic, bus.SubscriberCount(topic))
	}
}

// channelsSubscribeHandler streams payloads from `?topic=…` over SSE.
// One `data:` frame per published payload, plus periodic `: ka`
// keepalive comments. The subscriber receives whatever's in the
// topic's history ring first (same contract as pubsub.Bus.Subscribe)
// followed by every subsequent publish.
//
// Unlike /channels/live (which streams Phoenix WIRE FRAMES — joins,
// replies, heartbeats), this endpoint streams ONLY published payloads
// — the clean message bytes, ready for consumption.
func channelsSubscribeHandler(bus *pubsub.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		topic := r.URL.Query().Get("topic")
		if topic == "" {
			http.Error(w, "topic query parameter is required", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		ch, cancel := bus.Subscribe(topic)
		defer cancel()

		keepalive := time.NewTicker(15 * time.Second)
		defer keepalive.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-keepalive.C:
				_, _ = w.Write([]byte(": ka\n\n"))
				flusher.Flush()
			case payload, ok := <-ch:
				if !ok {
					return
				}
				_, _ = w.Write([]byte("data: "))
				_, _ = w.Write(payload)
				_, _ = w.Write([]byte("\n\n"))
				flusher.Flush()
			}
		}
	}
}

// --- channel introspection --------------------------------------------------

// channelsListHandler returns a snapshot of currently-active topics
// and how many subscribers each has, summed across WS sessions (via
// the ChannelBus) and HTTP /channels/subscribe listeners (via the
// pubsub Bus). Renders `{}` when nothing is active.
func channelsListHandler(cb *wsbroker.ChannelBus, bus *pubsub.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		out := make(map[string]int)
		for t, n := range cb.Topics() {
			out[t] += n
		}
		if bus != nil {
			for _, t := range bus.Topics() {
				out[t] += bus.SubscriberCount(t)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	}
}

// channelsMessagesHandler returns recent Phoenix frames from the
// bus's ring buffer. Filterable via `?topic=realtime:<channel>` —
// without the filter, every topic is included. Direction (in/out) is
// preserved so operators can see both what the client sent and what
// the server replied with.
func channelsMessagesHandler(cb *wsbroker.ChannelBus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		topic := r.URL.Query().Get("topic")
		frames := cb.Snapshot(topic)
		w.Header().Set("Content-Type", "application/json")
		// SetEscapeHTML(false) — by default the encoder rewrites <, >,
		// and & in JSON output, INCLUDING bytes carried in a
		// json.RawMessage. Frame.Frame is meant to be byte-identical to
		// what hit the wire (it's what the doc-string promises), so HTML
		// escaping would corrupt any frame whose payload contains those
		// characters.
		enc := json.NewEncoder(w)
		enc.SetEscapeHTML(false)
		_ = enc.Encode(frames)
	}
}

// channelsLiveHandler streams Phoenix frames over Server-Sent Events.
// Mirrors `/live_logs` semantically — one `data:` frame per event,
// periodic keepalive comments. `?topic=…` narrows to one channel.
//
// On connect, the subscriber receives whatever is currently in the
// channel-bus ring (best effort — drops cleanly if the channel buffer
// is already full at handshake time), then every subsequent frame.
// Same pre-fill behavior as `/live_logs` so an operator opening the
// stream sees context immediately.
func channelsLiveHandler(cb *wsbroker.ChannelBus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		topic := r.URL.Query().Get("topic")
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)
		// Flush headers immediately so the client knows the stream is
		// open even before the first frame arrives. Without this, the
		// browser sits with no readable progress for up to 15 s (one
		// keepalive interval).
		flusher.Flush()

		ch, cancel := cb.Subscribe(topic)
		defer cancel()

		keepalive := time.NewTicker(15 * time.Second)
		defer keepalive.Stop()

		// SetEscapeHTML(false) — see channelsMessagesHandler for why.
		// The Frame.Frame field is meant to be byte-identical to the
		// wire bytes; default HTML-escaping would silently rewrite
		// `<`, `>`, and `&` inside JSON strings.
		enc := json.NewEncoder(w)
		enc.SetEscapeHTML(false)
		for {
			select {
			case <-r.Context().Done():
				return
			case <-keepalive.C:
				_, _ = w.Write([]byte(": ka\n\n"))
				flusher.Flush()
			case frame, ok := <-ch:
				if !ok {
					return
				}
				_, _ = w.Write([]byte("data: "))
				_ = enc.Encode(frame) // Encode appends the trailing '\n'.
				// Second '\n' completes the SSE record (blank-line terminator).
				_, _ = w.Write([]byte("\n"))
				flusher.Flush()
			}
		}
	}
}

// --- helpers ----------------------------------------------------------------

func serveFile(fsys fs.FS, name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", contentType(name))
		_, _ = w.Write(data)
	}
}

func redirect(to string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, to, http.StatusFound)
	}
}

// arrayDecoder walks a JSON array element-by-element, returning each
// element as raw bytes so we can re-serialize one-per-line without
// double-encoding.
type arrayDecoder struct {
	dec *json.Decoder
}

func newArrayDecoder(buf []byte) *arrayDecoder {
	d := json.NewDecoder(bytes.NewReader(buf))
	// Read the opening '['; if it isn't one, More() returns false and
	// next() will surface the error.
	_, _ = d.Token()
	return &arrayDecoder{dec: d}
}

func (a *arrayDecoder) more() bool { return a.dec.More() }

func (a *arrayDecoder) next() ([]byte, error) {
	var raw json.RawMessage
	if err := a.dec.Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode array element: %w", err)
	}
	return []byte(raw), nil
}

func contentType(name string) string {
	switch {
	case len(name) > 5 && name[len(name)-5:] == ".html":
		return "text/html; charset=utf-8"
	case len(name) > 5 && name[len(name)-5:] == ".yaml":
		return "application/yaml; charset=utf-8"
	}
	return "text/plain; charset=utf-8"
}

