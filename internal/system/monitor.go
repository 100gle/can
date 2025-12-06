package system

import (
	"runtime"
	"time"
)

type Service struct {
	// dependencies for higher level metrics
	transferCountFunc func() int
}

func NewService(transferCountFunc func() int) *Service {
	return &Service{
		transferCountFunc: transferCountFunc,
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
