// Package api wires HTTP handlers to a Broadcaster.
package api

import (
	"bufio"
	"bytes"
	"embed"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/company/drift-observability/observability-server/internal/events"
)

//go:embed all:web
var webFS embed.FS

// Mux returns the HTTP handler for the observability-server.
func Mux(b *events.Broadcaster, tracePath string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /live_logs", liveLogsHandler(b))
	mux.HandleFunc("GET /events", eventsHandler(b))
	mux.HandleFunc("GET /events/all", allEventsHandler(tracePath))
	// `/events/log` returns the on-disk JSONL file verbatim — one event
	// per line, no array wrapping. Desktop / pprof-style tools download
	// this and replay it locally.
	mux.HandleFunc("GET /events/log", eventsLogHandler(tracePath))

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

func contentType(name string) string {
	switch {
	case len(name) > 5 && name[len(name)-5:] == ".html":
		return "text/html; charset=utf-8"
	case len(name) > 5 && name[len(name)-5:] == ".yaml":
		return "application/yaml; charset=utf-8"
	}
	return "text/plain; charset=utf-8"
}

