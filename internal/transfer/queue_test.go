package transfer

import (
	"testing"
)

func TestQueuePriorityOrdering(t *testing.T) {
	tq := newTaskQueue(10)
	defer tq.Close()

	// Push tasks with different priorities
	tq.Push("low", PriorityLow)
	tq.Push("normal", PriorityNormal)
	tq.Push("high", PriorityHigh)
	tq.Push("critical", PriorityCritical)

	// Pop should return in priority order (highest first)
	expected := []string{"critical", "high", "normal", "low"}
	for _, want := range expected {
		got, ok := tq.Pop(nil)
		if !ok {
			t.Fatalf("expected to pop %s, queue closed", want)
		}
		if got != want {
			t.Errorf("expected %s, got %s", want, got)
		}
	}
}

func TestQueueFIFOStability(t *testing.T) {
	tq := newTaskQueue(10)
	defer tq.Close()

	// Push tasks with same priority
	tq.Push("first", PriorityNormal)
	tq.Push("second", PriorityNormal)
	tq.Push("third", PriorityNormal)

	// Pop should return in FIFO order for same priority
	expected := []string{"first", "second", "third"}
	for _, want := range expected {
		got, ok := tq.Pop(nil)
		if !ok {
			t.Fatalf("expected to pop %s, queue closed", want)
		}
		if got != want {
			t.Errorf("expected %s, got %s", want, got)
		}
	}
}

func TestQueueCloseUnblocksWaiters(t *testing.T) {
	tq := newTaskQueue(10)

	done := make(chan struct{})
	go func() {
		_, ok := tq.Pop(nil)
		if ok {
			t.Error("expected Pop to return false after Close")
		}
		close(done)
	}()

	// Give goroutine time to block
	tq.Close()
	<-done
}

func TestQueueMixedPriorities(t *testing.T) {
	tq := newTaskQueue(10)
	defer tq.Close()

	// Interleave different priorities
	tq.Push("n1", PriorityNormal)
	tq.Push("h1", PriorityHigh)
	tq.Push("n2", PriorityNormal)
	tq.Push("l1", PriorityLow)
	tq.Push("h2", PriorityHigh)

	// Expected order: h1, h2, n1, n2, l1
	expected := []string{"h1", "h2", "n1", "n2", "l1"}
	for _, want := range expected {
		got, ok := tq.Pop(nil)
		if !ok {
			t.Fatalf("expected to pop %s, queue closed", want)
		}
		if got != want {
			t.Errorf("expected %s, got %s", want, got)
		}
	}
}

func TestQueuePushAfterClose(t *testing.T) {
	tq := newTaskQueue(10)
	tq.Close()

	// Push after close should not panic, just be ignored
	tq.Push("ignored", PriorityNormal)

	// Queue should be empty and closed
	_, ok := tq.Pop(nil)
	if ok {
		t.Error("expected Pop to return false for closed empty queue")
	}
}
