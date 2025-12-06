package app

import (
	"can/internal/analytics"
	"can/internal/system"
)

// GetAnalyticsSummary returns cost and traffic analysis for the given provider type (or 'all').
func (a *App) GetAnalyticsSummary(providerType string) (*analytics.AnalyticsSummary, error) {
	// Fallback alias for demo if frontend sends "all" or empty
	if providerType == "" || providerType == "all" {
		providerType = "aws" // Default to showing AWS pricing model for aggregate view
	}
	if a.analytics == nil {
		pricing := analytics.GetPricingModel(providerType)
		return &analytics.AnalyticsSummary{
			CostMonth: analytics.CostEstimate{
				Currency: pricing.Currency,
			},
		}, nil
	}

	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.analytics.GetMonthlySummary(ctx, providerType)
}

// GetSystemMetrics returns current system performance snapshot.
func (a *App) GetSystemMetrics() system.SystemMetrics {
	return a.system.GetMetrics()
}
