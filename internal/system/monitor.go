package system

import (
	"net/http"
	"runtime"
	"time"
)

type Service struct {
	// dependencies for higher level metrics
	transferCountFunc func() int
	httpClient        *http.Client
}

func NewService(transferCountFunc func() int) *Service {
	return &Service{
		transferCountFunc: transferCountFunc,
		httpClient:        &http.Client{Timeout: 10 * time.Second},
	}
}

// GetMetrics returns snapshot of current system state.
func (s *Service) GetMetrics() SystemMetrics {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	activeTransfers := 0
	if s.transferCountFunc != nil {
		activeTransfers = s.transferCountFunc()
	}

	return SystemMetrics{
		Timestamp:       time.Now(),
		MemoryAlloc:     m.Alloc,
		MemoryTotal:     m.TotalAlloc,
		MemorySys:       m.Sys,
		NumGoroutines:   runtime.NumGoroutine(),
		NumCgoCalls:     runtime.NumCgoCall(),
		ActiveTransfers: activeTransfers,
	}
}
