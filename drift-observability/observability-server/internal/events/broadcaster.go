// Package events keeps a bounded in-memory log of received event lines and
// fans them out to live SSE subscribers.
//
// Design notes:
//   - A subscriber is just a buffered channel; if the consumer falls behind,
//     we drop events for that subscriber rather than block the broadcaster.
//   - History uses a ring of fixed capacity — bounded memory, O(1) push.
//   - No file I/O. Durability is the caller's problem (drift's queue).
package events

import "sync"

// Subscriber is a buffered channel of event lines.
type Subscriber chan []byte

// Broadcaster receives lines via Push and fans them out to subscribers and
// the in-memory history ring.
type Broadcaster struct {
	mu          sync.Mutex
	subscribers map[Subscriber]struct{}
	ring        [][]byte
	cap         int
	next        int  // next write position in ring
	full        bool // has the ring wrapped at least once
}

// New returns a Broadcaster that keeps the last `historyCap` lines.
func New(historyCap int) *Broadcaster {
	if historyCap < 1 {
		historyCap = 1
	}
	return &Broadcaster{
		subscribers: make(map[Subscriber]struct{}),
		ring:        make([][]byte, historyCap),
		cap:         historyCap,
	}
}

// Push appends one line to history and fans it out to subscribers. Caller
// retains no ownership of the slice — Broadcaster copies it.
func (b *Broadcaster) Push(line []byte) {
	cp := make([]byte, len(line))
	copy(cp, line)

	b.mu.Lock()
	b.ring[b.next] = cp
	b.next = (b.next + 1) % b.cap
	if b.next == 0 {
		b.full = true
	}
	subs := make([]Subscriber, 0, len(b.subscribers))
	for s := range b.subscribers {
		subs = append(subs, s)
	}
	b.mu.Unlock()

	for _, s := range subs {
		select {
		case s <- cp:
		default:
			// Slow consumer — drop. Broadcaster never blocks.
		}
	}
}

// Subscribe returns a channel that receives the current history followed by
// every subsequent Push. Caller MUST call the returned cancel function.
func (b *Broadcaster) Subscribe() (Subscriber, func()) {
	ch := make(Subscriber, 256)
	b.mu.Lock()
	for _, line := range b.snapshotLocked() {
		select {
		case ch <- line:
		default:
		}
	}
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch, func() {
		b.mu.Lock()
		if _, ok := b.subscribers[ch]; ok {
			delete(b.subscribers, ch)
			close(ch)
		}
		b.mu.Unlock()
	}
}

// Snapshot returns a copy of the current history in chronological order.
func (b *Broadcaster) Snapshot() [][]byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.snapshotLocked()
}

// --- internals --------------------------------------------------------------

func (b *Broadcaster) snapshotLocked() [][]byte {
	if !b.full {
		out := make([][]byte, b.next)
		copy(out, b.ring[:b.next])
		return out
	}
	out := make([][]byte, 0, b.cap)
	out = append(out, b.ring[b.next:]...)
	out = append(out, b.ring[:b.next]...)
	return out
}
