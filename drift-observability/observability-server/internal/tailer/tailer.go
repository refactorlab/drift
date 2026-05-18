// Package tailer follows a JSONL file and pushes each complete line to a
// Broadcaster. It handles the file not existing yet (drift hasn't written its
// first event) by retrying on open failure.
package tailer

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/company/drift-observability/observability-server/internal/events"
)

const pollInterval = 100 * time.Millisecond

// Tailer reads new lines from path and pushes them to bus.
type Tailer struct {
	path string
	bus  *events.Broadcaster
}

func New(path string, bus *events.Broadcaster) *Tailer {
	return &Tailer{path: path, bus: bus}
}

// Run blocks until ctx is cancelled, continuously tailing the file.
func (t *Tailer) Run(ctx context.Context) {
	for ctx.Err() == nil {
		if err := t.tail(ctx); err != nil {
			slog.Debug("tailer waiting for file", "path", t.path, "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(pollInterval):
			}
		}
	}
}

// tail opens the file and reads until ctx is cancelled.
// Returns a non-nil error only when the file cannot be opened.
func (t *Tailer) tail(ctx context.Context) error {
	f, err := os.Open(t.path)
	if err != nil {
		return err
	}
	defer f.Close()

	slog.Info("tailer: following", "path", t.path)

	r := bufio.NewReaderSize(f, 64*1024)
	var partial []byte

	for {
		chunk, err := r.ReadBytes('\n')
		if len(chunk) > 0 {
			partial = append(partial, chunk...)
		}

		if err == nil {
			// ReadBytes returns nil error only when it found the delimiter:
			// partial now holds a complete, newline-terminated line.
			line := bytes.TrimRight(partial, "\r\n")
			if len(line) > 0 {
				cp := make([]byte, len(line))
				copy(cp, line)
				t.bus.Push(cp)
			}
			partial = partial[:0]
			continue
		}

		if errors.Is(err, io.EOF) {
			// Writer hasn't finished the line yet (or no new data).
			// partial stays buffered; we sleep and try to read more.
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(pollInterval):
			}
			continue
		}

		// Unexpected read error — log and bubble up so Run retries from open.
		slog.Warn("tailer: read error", "err", err)
		return err
	}
}
