// Package pubsub is a per-topic in-memory message bus. It powers the
// channel verbs the server exposes (publish, subscribe, listen) over
// both HTTP and WebSocket, so a payload published to topic X reaches
// every subscriber of X — regardless of which transport either side
// is using.
//
// Why a separate bus (vs. events.Broadcaster):
//
//   - events.Broadcaster is a single global stream with no topic
//     concept. Every event reaches every subscriber.
//   - The wsbroker.ChannelBus is a debug TAP that observes Phoenix
//     wire frames — it doesn't drive fanout.
//   - To make `POST /channels/publish?topic=X` deliver to *only*
//     subscribers of X (WS or HTTP), we need real per-topic routing.
//     That's this package.
//
// Contract:
//
//   - Bus.Publish never blocks. Slow subscribers DROP — the publisher
//     pays one constant-time per-subscriber send attempt and moves on.
//   - Each topic has its own bounded history ring; Subscribe returns
//     a channel that receives the snapshot first, then live publishes.
//   - Topics are created lazily on first Publish or Subscribe and
//     reaped when both subscribers and history hit zero, so an idle
//     server doesn't leak topic state for short-lived publishers.
package pubsub

import (
	"encoding/json"
	"sync"
)

// Payload is a single message on the bus. Kept as raw JSON so
// publishers and subscribers don't pay re-marshal costs on the hot
// path — the bus is shape-agnostic.
type Payload = json.RawMessage

// subscriber is a buffered channel of payloads plus the topic it's
// listening on (kept here so cancel can route to the right slot).
type subscriber struct {
	ch    chan Payload
	topic string
}

// topicState holds the ring and subscriber set for one topic.
type topicState struct {
	ring []Payload
	cap  int
	next int
	full bool
	subs map[*subscriber]struct{}
}

// Bus is safe for concurrent use.
type Bus struct {
	mu         sync.Mutex
	topics     map[string]*topicState
	historyCap int
}

// New returns a Bus whose per-topic history rings hold the last
// `historyCap` payloads. Pass 0 to disable history (live-only).
func New(historyCap int) *Bus {
	if historyCap < 0 {
		historyCap = 0
	}
	return &Bus{
		topics:     make(map[string]*topicState),
		historyCap: historyCap,
	}
}

// Publish delivers payload to every subscriber of topic AND records
// it in the topic's history ring. Slow subscribers DROP.
//
// The caller retains no ownership of payload — Bus copies the bytes
// so a later mutation can't tear a ring entry.
func (b *Bus) Publish(topic string, payload Payload) {
	cp := make(Payload, len(payload))
	copy(cp, payload)

	b.mu.Lock()
	defer b.mu.Unlock()
	st := b.ensureTopicLocked(topic)
	if st.cap > 0 {
		st.ring[st.next] = cp
		st.next = (st.next + 1) % st.cap
		if st.next == 0 {
			st.full = true
		}
	}
	// Deliver under the lock. The sends are non-blocking (buffered
	// channels with default-drop), so the lock is held only for one
	// queue-push per subscriber — fast and bounded. Doing this OUTSIDE
	// the lock would let cancel() close a channel between our snapshot
	// and our send, panicking on "send to closed channel".
	for s := range st.subs {
		select {
		case s.ch <- cp:
		default:
			// Drop on overflow — broker never blocks.
		}
	}
}

// Subscribe returns a channel that receives the topic's current
// history, then every subsequent Publish, plus a cancel function the
// caller MUST invoke when finished. The channel closes on cancel.
func (b *Bus) Subscribe(topic string) (<-chan Payload, func()) {
	sub := &subscriber{
		ch:    make(chan Payload, 256),
		topic: topic,
	}
	b.mu.Lock()
	st := b.ensureTopicLocked(topic)
	for _, p := range snapshotLocked(st) {
		select {
		case sub.ch <- p:
		default:
		}
	}
	st.subs[sub] = struct{}{}
	b.mu.Unlock()

	return sub.ch, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		st, ok := b.topics[sub.topic]
		if !ok {
			return
		}
		if _, present := st.subs[sub]; present {
			delete(st.subs, sub)
			close(sub.ch)
		}
		// Reap topics that have no subscribers AND no history left to
		// matter. Pure live-only buses (historyCap=0) reap eagerly.
		if len(st.subs) == 0 && (st.cap == 0 || (!st.full && st.next == 0)) {
			delete(b.topics, sub.topic)
		}
	}
}

// Snapshot returns the current ring contents of topic in
// chronological order. Returns nil for topics that don't exist.
func (b *Bus) Snapshot(topic string) []Payload {
	b.mu.Lock()
	defer b.mu.Unlock()
	st, ok := b.topics[topic]
	if !ok {
		return nil
	}
	all := snapshotLocked(st)
	out := make([]Payload, len(all))
	copy(out, all)
	return out
}

// Topics returns the currently-active topics: those with either a
// subscriber or at least one entry in the ring.
func (b *Bus) Topics() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]string, 0, len(b.topics))
	for t := range b.topics {
		out = append(out, t)
	}
	return out
}

// SubscriberCount returns the number of active subscribers on topic.
// Useful for /channels list endpoints.
func (b *Bus) SubscriberCount(topic string) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	st, ok := b.topics[topic]
	if !ok {
		return 0
	}
	return len(st.subs)
}

func (b *Bus) ensureTopicLocked(topic string) *topicState {
	st, ok := b.topics[topic]
	if ok {
		return st
	}
	st = &topicState{
		cap:  b.historyCap,
		subs: make(map[*subscriber]struct{}),
	}
	if b.historyCap > 0 {
		st.ring = make([]Payload, b.historyCap)
	}
	b.topics[topic] = st
	return st
}

func snapshotLocked(st *topicState) []Payload {
	if st.cap == 0 {
		return nil
	}
	if !st.full {
		out := make([]Payload, st.next)
		copy(out, st.ring[:st.next])
		return out
	}
	out := make([]Payload, 0, st.cap)
	out = append(out, st.ring[st.next:]...)
	out = append(out, st.ring[:st.next]...)
	return out
}
