package transfer

import (
	"container/heap"
	"sync"
)

// item wraps a task ID and its priority for the heap.
type item struct {
	value    string // taskID
	priority Priority
	// index is needed by update and is maintained by the heap.Interface methods.
	index int
	// insertionOrder ensures stability (FIFO for same priority)
	insertionOrder int64
}

// priorityQueue implements heap.Interface and holds Items.
type priorityQueue []*item

func (pq priorityQueue) Len() int { return len(pq) }

func (pq priorityQueue) Less(i, j int) bool {
	// We want Pop to give us the highest, not lowest, priority so we use greater than here.
	// standard container/heap is a MinHeap, so Less(i, j) = true means i comes before j.
	// Higher priority value should come first, so we return true when i.priority > j.priority.
	if pq[i].priority != pq[j].priority {
		return pq[i].priority > pq[j].priority
	}
	// If priorities are equal, use insertion order for FIFO (lower insertionOrder comes first)
	return pq[i].insertionOrder < pq[j].insertionOrder
}

// We need a secondary sort key for stability?
// Actually, let's just add an insertion sequence number to be sure.

func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *priorityQueue) Push(x any) {
	n := len(*pq)
	item := x.(*item)
	item.index = n
	*pq = append(*pq, item)
}

func (pq *priorityQueue) Pop() any {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil  // avoid memory leak
	item.index = -1 // for safety
	*pq = old[0 : n-1]
	return item
}

// taskQueue is a thread-safe wrapper around priorityQueue with a condition variable.
type taskQueue struct {
	pq        priorityQueue
	mu        sync.Mutex
	cond      *sync.Cond
	closed    bool
	itemCount int64 // monotonic counter for stable sort if needed, but for now simple priority is enough.
}

func newTaskQueue(capacity int) *taskQueue {
	tq := &taskQueue{
		pq: make(priorityQueue, 0, capacity),
	}
	tq.cond = sync.NewCond(&tq.mu)
	return tq
}

func (tq *taskQueue) Push(taskID string, priority Priority) {
	tq.mu.Lock()
	defer tq.mu.Unlock()

	if tq.closed {
		return
	}

	tq.itemCount++
	heap.Push(&tq.pq, &item{
		value:          taskID,
		priority:       priority,
		insertionOrder: tq.itemCount,
	})
	tq.cond.Signal()
}

// Pop returns the next task from the queue.
// It accepts a 'shouldWait' predicate. If the queue is empty, it waits on the condition variable
// as long as shouldWait() returns true and the queue is not closed.
// If shouldWait() returns false, it returns "", false immediately (acting as if woken up with no work).
func (tq *taskQueue) Pop(shouldWait func() bool) (string, bool) {
	tq.mu.Lock()
	defer tq.mu.Unlock()

	for len(tq.pq) == 0 && !tq.closed {
		if shouldWait != nil && !shouldWait() {
			return "", false
		}
		tq.cond.Wait()
	}

	if len(tq.pq) == 0 {
		return "", false
	}

	item := heap.Pop(&tq.pq).(*item)
	return item.value, true
}

func (tq *taskQueue) Broadcast() {
	tq.mu.Lock()
	defer tq.mu.Unlock()
	tq.cond.Broadcast()
}

func (tq *taskQueue) Close() {
	tq.mu.Lock()
	defer tq.mu.Unlock()
	tq.closed = true
	tq.cond.Broadcast()
}
