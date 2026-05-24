package pubsub

import (
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestPublishDeliversToSubscriberOfSameTopic(t *testing.T) {
	b := New(10)
	ch, cancel := b.Subscribe("realtime:foo")
	defer cancel()

	b.Publish("realtime:foo", json.RawMessage(`{"a":1}`))

	select {
	case p := <-ch:
		if string(p) != `{"a":1}` {
			t.Fatalf("got %s, want {\"a\":1}", p)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for payload")
	}
}

func TestPublishDoesNotLeakAcrossTopics(t *testing.T) {
	b := New(10)
	chFoo, cancelFoo := b.Subscribe("realtime:foo")
	defer cancelFoo()
	chBar, cancelBar := b.Subscribe("realtime:bar")
	defer cancelBar()

	b.Publish("realtime:foo", json.RawMessage(`{"who":"foo"}`))

	select {
	case p := <-chFoo:
		if string(p) != `{"who":"foo"}` {
			t.Fatalf("foo got %s", p)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("foo subscriber didn't get its message")
	}

	// bar must NOT receive the foo message within a short window.
	select {
	case p := <-chBar:
		t.Fatalf("bar received cross-topic payload: %s", p)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestSubscribeReceivesHistorySnapshot(t *testing.T) {
	b := New(5)
	for i := 0; i < 3; i++ {
		b.Publish("t", json.RawMessage(fmt.Sprintf(`{"n":%d}`, i)))
	}
	ch, cancel := b.Subscribe("t")
	defer cancel()

	for i := 0; i < 3; i++ {
		select {
		case p := <-ch:
			want := fmt.Sprintf(`{"n":%d}`, i)
			if string(p) != want {
				t.Fatalf("history[%d] = %s, want %s", i, p, want)
			}
		case <-time.After(time.Second):
			t.Fatalf("timeout on history[%d]", i)
		}
	}
}

func TestCancelClosesChannelAndStopsDelivery(t *testing.T) {
	b := New(10)
	ch, cancel := b.Subscribe("t")
	cancel()

	// Channel must be closed.
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("expected closed channel")
		}
	case <-time.After(time.Second):
		t.Fatal("channel not closed after cancel")
	}

	// Publish after cancel must not panic / deliver.
	b.Publish("t", json.RawMessage(`{"x":1}`))
}

func TestSlowSubscriberDropsRatherThanBlocking(t *testing.T) {
	b := New(10)
	_, cancel := b.Subscribe("flood") // never read
	defer cancel()

	// Publish many more messages than the 256-buf channel can hold.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 5_000; i++ {
			b.Publish("flood", json.RawMessage(`{}`))
		}
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on slow subscriber")
	}
}

func TestTopicsAndSubscriberCount(t *testing.T) {
	b := New(5)
	_, cancelA := b.Subscribe("a")
	_, cancelB1 := b.Subscribe("b")
	_, cancelB2 := b.Subscribe("b")

	if got := b.SubscriberCount("a"); got != 1 {
		t.Fatalf("a count = %d", got)
	}
	if got := b.SubscriberCount("b"); got != 2 {
		t.Fatalf("b count = %d", got)
	}
	if got := b.SubscriberCount("missing"); got != 0 {
		t.Fatalf("missing count = %d", got)
	}

	cancelA()
	cancelB1()
	cancelB2()

	// After all cancels with empty history, topics should be reaped.
	for _, topic := range b.Topics() {
		if c := b.SubscriberCount(topic); c == 0 && len(b.Snapshot(topic)) == 0 {
			t.Fatalf("expected reaped, still present: %q", topic)
		}
	}
}

func TestPublishCopiesPayloadBytes(t *testing.T) {
	b := New(5)
	ch, cancel := b.Subscribe("t")
	defer cancel()

	src := []byte(`{"v":"first"}`)
	b.Publish("t", src)
	// Mutate the caller's buffer.
	copy(src, []byte(`{"v":"OOPS!"}`))

	select {
	case got := <-ch:
		if string(got) != `{"v":"first"}` {
			t.Fatalf("payload tearing: got %s, want %s", got, `{"v":"first"}`)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout")
	}
}

func TestConcurrentPublishSubscribe(t *testing.T) {
	b := New(20)
	var wg sync.WaitGroup
	stop := make(chan struct{})

	// 4 publishers on different topics.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			topic := fmt.Sprintf("t%d", i)
			for {
				select {
				case <-stop:
					return
				default:
				}
				b.Publish(topic, json.RawMessage(`{}`))
			}
		}(i)
	}
	// 4 subscribers, churning subscribe/cancel.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for n := 0; ; n++ {
				select {
				case <-stop:
					return
				default:
				}
				_, cancel := b.Subscribe(fmt.Sprintf("t%d", i%4))
				time.Sleep(time.Millisecond)
				cancel()
			}
		}(i)
	}

	time.Sleep(150 * time.Millisecond)
	close(stop)
	wg.Wait()
}
