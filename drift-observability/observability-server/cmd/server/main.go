// observability-server: tails a JSONL file written by drift-instrumented
// services, fans each event to /live_logs (SSE), and keeps a bounded
// in-memory history at /events. Swagger UI at /docs/.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/company/drift-observability/observability-server/internal/api"
	"github.com/company/drift-observability/observability-server/internal/events"
	"github.com/company/drift-observability/observability-server/internal/tailer"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	listenAddr := envOr("LISTEN_ADDR", ":8080")
	historyCap := envInt("HISTORY_CAP", 1000)
	tracePath := envOr("TRACE_PATH", "/trace/events.log")

	bus := events.New(historyCap)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	t := tailer.New(tracePath, bus)
	go t.Run(ctx)

	srv := &http.Server{
		Addr:              listenAddr,
		Handler:           api.Mux(bus),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go shutdownOnSignal(srv, cancel)

	slog.Info("observability-server up",
		"addr", listenAddr,
		"history_cap", historyCap,
		"trace_path", tracePath,
	)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("listen failed", "err", err)
		os.Exit(1)
	}
}

func shutdownOnSignal(srv *http.Server, cancel context.CancelFunc) {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	cancel() // stop the tailer
	ctx, c := context.WithTimeout(context.Background(), 5*time.Second)
	defer c()
	_ = srv.Shutdown(ctx)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
