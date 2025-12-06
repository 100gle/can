package transfer

import (
	"context"
	"testing"
	"time"
)

func TestRateLimiterNoLimit(t *testing.T) {
	limiter := NewRateLimiter(0)
	ctx := context.Background()

	// Should return immediately when no limit is set
	start := time.Now()
	if err := limiter.WaitAndConsume(ctx, 1024*1024); err != nil {
		t.Fatalf("WaitAndConsume failed: %v", err)
	}
	elapsed := time.Since(start)
	if elapsed > 50*time.Millisecond {
		t.Errorf("Expected immediate return with no limit, got %v", elapsed)
	}
}

func TestRateLimiterWithLimit(t *testing.T) {
	// Set limit to 1KB/s
	limiter := NewRateLimiter(1024)
	ctx := context.Background()

	// First request should consume the initial tokens
	start := time.Now()
	if err := limiter.WaitAndConsume(ctx, 512); err != nil {
		t.Fatalf("First WaitAndConsume failed: %v", err)
	}
	elapsed := time.Since(start)
	if elapsed > 50*time.Millisecond {
		t.Errorf("First request should be immediate, got %v", elapsed)
	}

	// Second request should wait for token refill
	start = time.Now()
	if err := limiter.WaitAndConsume(ctx, 1024); err != nil {
		t.Fatalf("Second WaitAndConsume failed: %v", err)
	}
	elapsed = time.Since(start)
	// Should wait at least ~500ms for tokens to refill
	if elapsed < 400*time.Millisecond {
		t.Errorf("Expected delay for rate limiting, got %v", elapsed)
	}
}

func TestRateLimiterSetLimit(t *testing.T) {
	limiter := NewRateLimiter(1024)

	if got := limiter.Limit(); got != 1024 {
		t.Errorf("Expected limit 1024, got %d", got)
	}

	limiter.SetLimit(2048)
	if got := limiter.Limit(); got != 2048 {
		t.Errorf("Expected limit 2048, got %d", got)
	}

	limiter.SetLimit(0)
	if got := limiter.Limit(); got != 0 {
		t.Errorf("Expected limit 0, got %d", got)
	}
}

func TestRateLimiterContextCanceled(t *testing.T) {
	limiter := NewRateLimiter(100) // Very slow rate
	ctx, cancel := context.WithCancel(context.Background())

	// Consume all tokens
	_ = limiter.WaitAndConsume(ctx, 100)

	// Cancel context before waiting
	cancel()

	// Should return immediately with context error
	start := time.Now()
	err := limiter.WaitAndConsume(ctx, 100)
	elapsed := time.Since(start)

	if err != context.Canceled {
		t.Errorf("Expected context.Canceled, got %v", err)
	}
	if elapsed > 100*time.Millisecond {
		t.Errorf("Expected quick return on cancel, got %v", elapsed)
	}
}

func TestComputeBackoff(t *testing.T) {
	svc := &Service{}

	tests := []struct {
		attempt  int
		expected time.Duration
	}{
		{0, 1 * time.Second},
		{1, 1 * time.Second},
		{2, 2 * time.Second},
		{3, 4 * time.Second},
		{4, 8 * time.Second},
		{5, 16 * time.Second},
		{6, 30 * time.Second}, // Capped at 30s
		{10, 30 * time.Second},
	}

	for _, tt := range tests {
		got := svc.computeBackoff(tt.attempt)
		if got != tt.expected {
			t.Errorf("computeBackoff(%d) = %v, want %v", tt.attempt, got, tt.expected)
		}
	}
}
