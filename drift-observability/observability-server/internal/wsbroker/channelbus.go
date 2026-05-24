// ChannelBus is the per-topic mirror of events.Broadcaster: every
// Phoenix-Channels frame the broker sends OR receives is teed onto a
// bounded in-memory ring AND fanned out to live HTTP subscribers, so
// operators can watch the wire-level traffic for a given channel
// without attaching a real WebSocket client.
//
// Why a separate bus (instead of teeing into events.Broadcaster):
//
//   - The events bus carries *event objects* (the JSONL the profiler
//     emits). The channel bus carries *Phoenix envelopes* (the WS wire
//     format including topic / phx_reply / heartbeat). Mixing them
//     would force every consumer to discriminate by shape.
//   - The channel bus needs topic filtering at the subscriber level
//     (one channel == one topic). Events have no topic concept.
//   - The channel bus tracks `topic → subscriber count` so
//     `GET /channels` can list active channels — the events bus has
//     no such notion.
package wsbroker

import (
	"encoding/json"
	"sync"
	"time"
)

// Direction is which way a frame travelled relative to the server.
type Direction string

const (
	// DirectionIn — a frame the server received from a WS client.
	DirectionIn Direction = "in"
	// DirectionOut — a frame the server wrote to a WS client.
	DirectionOut Direction = "out"
)

// Frame is one observed Phoenix envelope plus metadata.
//
// `Frame` (the JSON bytes) is kept as a json.RawMessage rather than
// being re-decoded so the consumer sees byte-for-byte what was on the
// wire — including any extra fields the broker doesn't model.
type Frame struct {
	Topic     string          `json:"topic"`
	Direction Direction       `json:"direction"`
	Event     string          `json:"event"`
	Time      time.Time       `json:"time"`
	Frame     json.RawMessage `json:"frame"`
}

// channelSubscriber is a buffered channel of frames plus an optional
// topic filter (empty string means "every topic").
type channelSubscriber struct {
	ch          chan Frame
	topicFilter string
}

// ChannelBus is safe for concurrent use. Publish, Subscribe, Snapshot,
// Joined, Left and Topics may all be called from any goroutine.
type ChannelBus struct {
	mu          sync.Mutex
	ring        []Frame
	cap         int
	next        int
	full        bool
	subscribers map[*channelSubscriber]struct{}
	// active topics → number of sessions joined to this topic. Updated
	// by Joined/Left; readable by Topics(). Sessions are NOT keyed
	// here — only the aggregate count, which is what
	// `GET /channels` needs to render.
	subsByTopic map[string]int
}

// NewChannelBus returns a bus that keeps the last `historyCap` frames
// in-memory. Pass 0 to disable history (live-only).
func NewChannelBus(historyCap int) *ChannelBus {
	if historyCap < 0 {
		historyCap = 0
	}
	cb := &ChannelBus{
		cap:         historyCap,
		subscribers: make(map[*channelSubscriber]struct{}),
		subsByTopic: make(map[string]int),
	}
	if historyCap > 0 {
		cb.ring = make([]Frame, historyCap)
	}
	return cb
}

// Publish records f in the ring (if cap > 0) and fans it out to every
// subscriber whose filter matches. Slow subscribers DROP — we never
// block the broker for an HTTP consumer.
func (cb *ChannelBus) Publish(f Frame) {
	if f.Time.IsZero() {
		f.Time = time.Now().UTC()
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.cap > 0 {
		cb.ring[cb.next] = f
		cb.next = (cb.next + 1) % cb.cap
		if cb.next == 0 {
			cb.full = true
		}
	}
	// Send under the lock — sends are non-blocking so the lock-hold
	// time is O(subscribers). Holding the lock here is what makes
	// Subscribe's cancel `close(s.ch)` race-free; otherwise a Publish
	// in flight would panic on "send on closed channel".
	for s := range cb.subscribers {
		if s.topicFilter != "" && s.topicFilter != f.Topic {
			continue
		}
		select {
		case s.ch <- f:
		default:
			// Drop on overflow — same contract as events.Broadcaster.
		}
	}
}

// Subscribe returns a channel that receives every frame matching the
// supplied topic filter (empty = all topics) along with a cancel
// function the caller MUST invoke. The channel is closed by cancel.
//
// Recent history matching the filter is delivered first (best-effort:
// drops cleanly if the channel buffer is full).
func (cb *ChannelBus) Subscribe(topicFilter string) (<-chan Frame, func()) {
	sub := &channelSubscriber{
		ch:          make(chan Frame, 256),
		topicFilter: topicFilter,
	}
	cb.mu.Lock()
	for _, f := range cb.snapshotLocked() {
		if topicFilter != "" && topicFilter != f.Topic {
			continue
		}
		select {
		case sub.ch <- f:
		default:
		}
	}
	cb.subscribers[sub] = struct{}{}
	cb.mu.Unlock()
	return sub.ch, func() {
		cb.mu.Lock()
		if _, ok := cb.subscribers[sub]; ok {
			delete(cb.subscribers, sub)
			close(sub.ch)
		}
		cb.mu.Unlock()
	}
}

// Snapshot returns the current ring contents (oldest first), filtered
// by topic if non-empty. Safe to call concurrently.
func (cb *ChannelBus) Snapshot(topicFilter string) []Frame {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	all := cb.snapshotLocked()
	if topicFilter == "" {
		out := make([]Frame, len(all))
		copy(out, all)
		return out
	}
	out := make([]Frame, 0, len(all))
	for _, f := range all {
		if f.Topic == topicFilter {
			out = append(out, f)
		}
	}
	return out
}

// Joined registers that a session joined `topic`. Called from
// session.handleJoin. Increments the per-topic count.
func (cb *ChannelBus) Joined(topic string) {
	cb.mu.Lock()
	cb.subsByTopic[topic]++
	cb.mu.Unlock()
}

// Left registers that a session left `topic`. Called from
// session.handleFrame on phx_leave and from session.run on disconnect
// for every topic the session was joined to. Decrements toward zero;
// at zero the topic is removed from the map so Topics() doesn't return
// ghost entries.
func (cb *ChannelBus) Left(topic string) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	n := cb.subsByTopic[topic]
	if n <= 1 {
		delete(cb.subsByTopic, topic)
		return
	}
	cb.subsByTopic[topic] = n - 1
}

// Topics returns a snapshot of currently-joined topics and their
// subscriber counts. Zero-count topics are omitted.
func (cb *ChannelBus) Topics() map[string]int {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	out := make(map[string]int, len(cb.subsByTopic))
	for k, v := range cb.subsByTopic {
		out[k] = v
	}
	return out
}

// snapshotLocked returns the ring contents in chronological order.
// Caller must hold cb.mu.
func (cb *ChannelBus) snapshotLocked() []Frame {
	if cb.cap == 0 {
		return nil
	}
	if !cb.full {
		out := make([]Frame, cb.next)
		copy(out, cb.ring[:cb.next])
		return out
	}
	out := make([]Frame, 0, cb.cap)
	out = append(out, cb.ring[cb.next:]...)
	out = append(out, cb.ring[:cb.next]...)
	return out
}
