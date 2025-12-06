package analytics

import (
	"context"
	"time"
)

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

// RecordActivity is the main entry point to log usage.
func (s *Service) RecordActivity(ctx context.Context, provider string, uploadBytes, downloadBytes int64) error {
	// We count 1 request per call for simplicity in this MVP.
	// In a real system, we'd distinguish GET vs PUT.
	return s.store.RecordUsage(ctx, provider, uploadBytes, downloadBytes, 1)
}

// GetMonthlySummary calculates costs and aggregates traffic for the current month.
func (s *Service) GetMonthlySummary(ctx context.Context, providerType string) (*AnalyticsSummary, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, -1)

	// Get usage for this month
	records, err := s.store.GetUsage(ctx, startOfMonth, endOfMonth)
	if err != nil {
		return nil, err
	}

	today := now.Format("2006-01-02")
	var statsToday TrafficStats
	var statsMonth TrafficStats

	includeAllProviders := providerType == "" || providerType == "all"
	for _, r := range records {
		// Skip records that do not match the requested provider filter.
		if !includeAllProviders && r.Provider != providerType {
			continue
		}

		// Aggregate month stats
		statsMonth.UploadBytes += r.UploadBytes
		statsMonth.DownloadBytes += r.DownloadBytes
		statsMonth.RequestCount += r.RequestCount

		// Check if it's today
		if r.Date == today {
			statsToday.UploadBytes += r.UploadBytes
			statsToday.DownloadBytes += r.DownloadBytes
			statsToday.RequestCount += r.RequestCount
		}
	}

	// Calculate Cost
	pricing := GetPricingModel(providerType)
	cost := s.calculateCost(statsMonth, pricing)

	return &AnalyticsSummary{
		TrafficToday: statsToday,
		TrafficMonth: statsMonth,
		CostMonth:    cost,
	}, nil
}

func (s *Service) calculateCost(stats TrafficStats, pricing PricingModel) CostEstimate {
	// Convert bytes to GB
	gb := 1024.0 * 1024.0 * 1024.0

	downloadGB := float64(stats.DownloadBytes) / gb
	uploadGB := float64(stats.UploadBytes) / gb
	reqThousands := float64(stats.RequestCount) / 1000.0

	// Note: We don't have stored total storage size here, only transfer.
	// For this MVP, we will only calculate Transfer & Request costs.
	// Storage cost would require a separate snapshot mechanism.

	trafficCost := (downloadGB * pricing.DownloadRate) + (uploadGB * pricing.UploadRate)
	reqCost := reqThousands * pricing.RequestRate

	return CostEstimate{
		TrafficCost: trafficCost,
		RequestCost: reqCost,
		StorageCost: 0, // Not implemented yet
		TotalCost:   trafficCost + reqCost,
		Currency:    pricing.Currency,
	}
}
