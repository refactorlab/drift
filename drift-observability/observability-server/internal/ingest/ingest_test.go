package ingest

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readAllLines(t *testing.T, path string) []string {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer f.Close()
	var out []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		out = append(out, sc.Text())
	}
	return out
}

func TestAppendLineCreatesFileAndAppends(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "events.log")
	w := New(path)
	defer w.Close()

	if _, err := w.AppendLine([]byte(`{"a":1}`)); err != nil {
		t.Fatalf("append: %v", err)
	}
	if _, err := w.AppendLine([]byte(`{"a":2}`)); err != nil {
		t.Fatalf("append: %v", err)
	}
	lines := readAllLines(t, path)
	if len(lines) != 2 || lines[0] != `{"a":1}` || lines[1] != `{"a":2}` {
		t.Fatalf("lines: %v", lines)
	}
}

func TestAppendLineRejectsInvalidJSON(t *testing.T) {
	dir := t.TempDir()
	w := New(filepath.Join(dir, "x.log"))
	defer w.Close()

	_, err := w.AppendLine([]byte(`not-json`))
	if !errors.Is(err, ErrInvalidJSON) {
		t.Fatalf("expected ErrInvalidJSON, got %v", err)
	}
}

func TestAppendNDJSONSkipsBlanksAndCountsAccepted(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "x.log")
	w := New(path)
	defer w.Close()

	input := strings.NewReader(
		`{"a":1}` + "\n" +
			"\n" + // blank
			`not-json` + "\n" +
			`{"a":2}` + "\n",
	)
	n, _ := w.AppendNDJSON(input)
	if n != 2 {
		t.Fatalf("expected 2 accepted, got %d", n)
	}
	lines := readAllLines(t, path)
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines on disk, got %d: %v", len(lines), lines)
	}
}

func TestAppendLineCreatesParentDir(t *testing.T) {
	dir := t.TempDir()
	deep := filepath.Join(dir, "a", "b", "c.log")
	w := New(deep)
	defer w.Close()

	if _, err := w.AppendLine([]byte(`{"ok":true}`)); err != nil {
		t.Fatalf("append: %v", err)
	}
	if _, err := os.Stat(deep); err != nil {
		t.Fatalf("file not created: %v", err)
	}
}

func TestAppendLineEmptyIsError(t *testing.T) {
	w := New(filepath.Join(t.TempDir(), "x.log"))
	defer w.Close()
	if _, err := w.AppendLine([]byte("   \n\t")); !errors.Is(err, ErrEmpty) {
		t.Fatalf("expected ErrEmpty, got %v", err)
	}
}
