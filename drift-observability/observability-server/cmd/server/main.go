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
	"github.com/company/drift-observability/observability-server/internal/ingest"
	"github.com/company/drift-observability/observability-server/internal/pubsub"
	"github.com/company/drift-observability/observability-server/internal/tailer"
	"github.com/company/drift-observability/observability-server/internal/wsbroker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	listenAddr := envOr("LISTEN_ADDR", ":8080")
	historyCap := envInt("HISTORY_CAP", 1000)
	channelHistoryCap := envInt("CHANNEL_HISTORY_CAP", 500)
	pubsubHistoryCap := envInt("PUBSUB_HISTORY_CAP", 200)
	tracePath := envOr("TRACE_PATH", "/trace/events.log")
	defaultChannel := envOr("DEFAULT_CHANNEL", "realtime:drift-profiler-events")

	bus := events.New(historyCap)
	channelBus := wsbroker.NewChannelBus(channelHistoryCap)
	pubBus := pubsub.New(pubsubHistoryCap)
	writer := ingest.New(tracePath)
	defer writer.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	t := tailer.New(tracePath, bus)
	go t.Run(ctx)

	// Bridge: every event that hits the legacy broadcaster is also
	// republished to the pubsub bus on the default channel. This lets
	// legacy publishers (POST /events, file tailer) reach modern
	// subscribers (POST /channels/publish, GET /channels/subscribe)
	// without anyone having to know about the other API.
	go bridgeLegacyToPubsub(ctx, bus, pubBus, defaultChannel)

	srv := &http.Server{
		Addr:              listenAddr,
		Handler:           api.Mux(bus, writer, tracePath, pubBus, channelBus),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go shutdownOnSignal(srv, cancel)

	slog.Info("observability-server up",
		"addr", listenAddr,
		"history_cap", historyCap,
		"channel_history_cap", channelHistoryCap,
		"pubsub_history_cap", pubsubHistoryCap,
		"trace_path", tracePath,
		"default_channel", defaultChannel,
	)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("listen failed", "err", err)
		os.Exit(1)
	}
}

// bridgeLegacyToPubsub forwards every event flowing through the
// legacy `events.Broadcaster` to the per-topic pubsub bus under
// `defaultChannel`. Lets a `POST /events` publisher (no channel
// awareness) be heard by `GET /channels/subscribe?topic=…` listeners
// and vice versa, without anyone changing protocol.
//
// Exits when ctx is cancelled (server shutdown).
func bridgeLegacyToPubsub(ctx context.Context, b *events.Broadcaster, pb *pubsub.Bus, defaultChannel string) {
	if pb == nil || defaultChannel == "" {
		return
	}
	ch, cancel := b.Subscribe()
	defer cancel()
	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-ch:
			if !ok {
				return
			}
			pb.Publish(defaultChannel, line)
		}
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
