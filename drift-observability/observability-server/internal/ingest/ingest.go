// Package ingest appends events received over HTTP to the on-disk trace
// file. The tailer (internal/tailer) follows the same file and is the
// single source of truth for the broadcaster — by writing through the
// file we get durable replay (via /events/all and /events/log) AND
// avoid any risk of double-broadcasting an event that arrived via POST.
//
// Concurrency: one ingest.Writer per process, holding an open file
// handle and a mutex. Each Append() does one write() call ending in
// '\n' under the lock — atomic up to PIPE_BUF for line-buffered
// readers, and atomic at the file-offset level for the tailer.
package ingest

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// Writer appends JSON event lines to the trace file. Safe for
// concurrent Append() calls.
type Writer struct {
	mu   sync.Mutex
	path string
	f    *os.File
}

// New returns a Writer that appends to path. The parent directory is
// created on demand; the file is opened lazily on first Append.
func New(path string) *Writer {
	return &Writer{path: path}
}

// Close releases the underlying file handle. Idempotent.
func (w *Writer) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.f == nil {
		return nil
	}
	err := w.f.Close()
	w.f = nil
	return err
}

// AppendLine writes one JSON-encoded event line to the trace file.
// The line is validated as JSON (so a bad client cannot corrupt the
// file the tailer reads from) and a trailing newline is appended if
// missing. Returns the number of bytes written (excluding the newline
// fixup) or a non-nil error if the disk write fails.
func (w *Writer) AppendLine(line []byte) (int, error) {
	line = bytes.TrimSpace(line)
	if len(line) == 0 {
		return 0, ErrEmpty
	}
	if !json.Valid(line) {
		return 0, ErrInvalidJSON
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.openLocked(); err != nil {
		return 0, err
	}

	// One write() per line so the tailer's bufio.Reader either sees a
	// complete '\n'-terminated record or no bytes at all.
	buf := make([]byte, 0, len(line)+1)
	buf = append(buf, line...)
	buf = append(buf, '\n')
	n, err := w.f.Write(buf)
	if err != nil {
		// Drop the handle on write error so the next call retries the
		// open — covers fd-killed-out-of-band, disk-remount, etc.
		_ = w.f.Close()
		w.f = nil
		return n, fmt.Errorf("write trace file: %w", err)
	}
	return n - 1, nil
}

// AppendNDJSON splits r into '\n'-terminated lines and writes each via
// AppendLine. Returns the number of lines accepted and the first
// non-fatal error (ErrEmpty / ErrInvalidJSON for a malformed line) so
// the caller can report partial success. A fatal disk error short-
// circuits with the error wrapped.
func (w *Writer) AppendNDJSON(r io.Reader) (int, error) {
	const maxLine = 4 * 1024 * 1024 // 4MiB — matches /events/all scanner cap.
	br := bufio.NewScanner(r)
	br.Buffer(make([]byte, 64*1024), maxLine)
	accepted := 0
	var firstSoftErr error
	for br.Scan() {
		line := br.Bytes()
		if _, err := w.AppendLine(line); err != nil {
			if errors.Is(err, ErrEmpty) || errors.Is(err, ErrInvalidJSON) {
				if firstSoftErr == nil {
					firstSoftErr = err
				}
				continue
			}
			return accepted, err
		}
		accepted++
	}
	if err := br.Err(); err != nil {
		return accepted, fmt.Errorf("scan ndjson: %w", err)
	}
	return accepted, firstSoftErr
}

func (w *Writer) openLocked() error {
	if w.f != nil {
		return nil
	}
	dir := filepath.Dir(w.path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create trace dir: %w", err)
		}
	}
	f, err := os.OpenFile(w.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open trace file: %w", err)
	}
	w.f = f
	return nil
}

// Sentinel errors so handlers can map to specific HTTP statuses.
var (
	ErrEmpty       = errors.New("empty event line")
	ErrInvalidJSON = errors.New("invalid JSON")
)
