// Package api wires HTTP handlers to a Broadcaster.
package api

import (
	"embed"
	"io/fs"
	"net/http"
	"time"

	"github.com/company/drift-observability/observability-server/internal/events"
)

//go:embed all:web
var webFS embed.FS

// Mux returns the HTTP handler for the observability-server.
func Mux(b *events.Broadcaster) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /live_logs", liveLogsHandler(b))
	mux.HandleFunc("GET /events", eventsHandler(b))

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

