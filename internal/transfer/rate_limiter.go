package transfer

import (
	"context"
	"sync"
	"time"
)

// RateLimiter controls the transfer speed using a token bucket algorithm.
type RateLimiter struct {
	mu          sync.Mutex
	bytesPerSec int64
	tokens      int64
	lastRefill  time.Time
}

// NewRateLimiter creates a rate limiter with the specified bytes per second limit.
// A limit of 0 or negative means no rate limiting.
func NewRateLimiter(bytesPerSec int64) *RateLimiter {
	return &RateLimiter{
		bytesPerSec: bytesPerSec,
		tokens:      bytesPerSec, // Start with a full bucket
		lastRefill:  time.Now(),
	}
}

// SetLimit updates the rate limit. A value of 0 or negative disables limiting.
func (r *RateLimiter) SetLimit(bytesPerSec int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.bytesPerSec = bytesPerSec
	if bytesPerSec > 0 {
		r.tokens = bytesPerSec
	}
	r.lastRefill = time.Now()
}

// Limit returns the current rate limit in bytes per second.
func (r *RateLimiter) Limit() int64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.bytesPerSec
}

// WaitAndConsume blocks until n bytes can be consumed, respecting the rate limit.
// If n exceeds the bucket capacity (bytesPerSec), it consumes in chunks.
// Returns immediately if rate limiting is disabled.
func (r *RateLimiter) WaitAndConsume(ctx context.Context, n int64) error {
	if n <= 0 {
		return nil
	}
	remaining := n
	for remaining > 0 {
		r.mu.Lock()
		if r.bytesPerSec <= 0 {
			r.mu.Unlock()
			return nil // No rate limiting
		}
		r.refill()
		// Consume up to available tokens or remaining bytes
		consume := remaining
		if consume > r.tokens {
			consume = r.tokens
		}
		if consume > 0 {
			r.tokens -= consume
			remaining -= consume
		}
		if remaining <= 0 {
			r.mu.Unlock()
			return nil
		}
		// Calculate wait time for more tokens
		waitTime := time.Duration(float64(remaining)/float64(r.bytesPerSec)*float64(time.Second)) + 10*time.Millisecond
		if waitTime > time.Second {
			waitTime = time.Second // Wait at most 1 second to allow refill
		}
		r.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
			// Continue loop to refill and consume more
		}
	}
	return nil
}

// refill adds tokens based on elapsed time since last refill.
// Must be called with mutex held.
func (r *RateLimiter) refill() {
	now := time.Now()
	elapsed := now.Sub(r.lastRefill)
	if elapsed <= 0 {
		return
	}
	add := int64(float64(r.bytesPerSec) * elapsed.Seconds())
	r.tokens += add
	// Cap at one second worth of tokens (burst limit)
	if r.tokens > r.bytesPerSec {
		r.tokens = r.bytesPerSec
	}
	r.lastRefill = now
}
