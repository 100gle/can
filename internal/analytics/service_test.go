package analytics

import (
	"context"
	"testing"
	"time"
)

func TestCalculateCostAWS(t *testing.T) {
	store := &mockStore{}
	svc := NewService(store)

	stats := TrafficStats{
		UploadBytes:   1 * 1024 * 1024 * 1024, // 1 GB
		DownloadBytes: 2 * 1024 * 1024 * 1024, // 2 GB
		RequestCount:  1000,
	}
	pricing := GetPricingModel("aws")

	cost := svc.calculateCost(stats, pricing)

	// Expected: download cost = 2 * 0.09 = 0.18, upload = 0, request = 1 * 0.005 = 0.005
	expectedTraffic := 2 * 0.09
	expectedRequest := 1 * 0.005
	expectedTotal := expectedTraffic + expectedRequest

	if !floatClose(cost.TrafficCost, expectedTraffic, 0.0001) {
		t.Errorf("TrafficCost: expected %.4f, got %.4f", expectedTraffic, cost.TrafficCost)
	}
	if !floatClose(cost.RequestCost, expectedRequest, 0.0001) {
		t.Errorf("RequestCost: expected %.4f, got %.4f", expectedRequest, cost.RequestCost)
	}
	if !floatClose(cost.TotalCost, expectedTotal, 0.0001) {
		t.Errorf("TotalCost: expected %.4f, got %.4f", expectedTotal, cost.TotalCost)
	}
	if cost.Currency != "USD" {
		t.Errorf("Currency: expected USD, got %s", cost.Currency)
	}
}

func TestCalculateCostR2FreeEgress(t *testing.T) {
	store := &mockStore{}
	svc := NewService(store)

	stats := TrafficStats{
		UploadBytes:   5 * 1024 * 1024 * 1024,  // 5 GB
		DownloadBytes: 10 * 1024 * 1024 * 1024, // 10 GB
		RequestCount:  50000,
	}
	pricing := GetPricingModel("r2")

	cost := svc.calculateCost(stats, pricing)

	// R2 has free egress and nearly free requests
	if cost.TrafficCost != 0 {
		t.Errorf("R2 TrafficCost should be 0, got %.4f", cost.TrafficCost)
	}
	if cost.TotalCost != 0 {
		t.Errorf("R2 TotalCost should be 0, got %.4f", cost.TotalCost)
	}
}

func TestGetMonthlySummaryFiltersProvider(t *testing.T) {
	today := time.Now().Format("2006-01-02")
	store := &mockStore{
		records: []UsageRecord{
			{Date: today, Provider: "aws", UploadBytes: 100, DownloadBytes: 200, RequestCount: 10},
			{Date: today, Provider: "oss", UploadBytes: 50, DownloadBytes: 75, RequestCount: 5},
		},
	}
	svc := NewService(store)
	ctx := context.Background()

	// Filter by aws only
	summary, err := svc.GetMonthlySummary(ctx, "aws")
	if err != nil {
		t.Fatalf("GetMonthlySummary: %v", err)
	}
	if summary.TrafficMonth.UploadBytes != 100 {
		t.Errorf("expected UploadBytes 100, got %d", summary.TrafficMonth.UploadBytes)
	}
	if summary.TrafficMonth.DownloadBytes != 200 {
		t.Errorf("expected DownloadBytes 200, got %d", summary.TrafficMonth.DownloadBytes)
	}
}

func TestGetMonthlySummaryAggregatesAll(t *testing.T) {
	today := time.Now().Format("2006-01-02")
	store := &mockStore{
		records: []UsageRecord{
			{Date: today, Provider: "aws", UploadBytes: 100, DownloadBytes: 200, RequestCount: 10},
			{Date: today, Provider: "oss", UploadBytes: 50, DownloadBytes: 75, RequestCount: 5},
		},
	}
	svc := NewService(store)
	ctx := context.Background()

	// Get all providers
	summary, err := svc.GetMonthlySummary(ctx, "all")
	if err != nil {
		t.Fatalf("GetMonthlySummary: %v", err)
	}
	if summary.TrafficMonth.UploadBytes != 150 {
		t.Errorf("expected UploadBytes 150, got %d", summary.TrafficMonth.UploadBytes)
	}
	if summary.TrafficMonth.DownloadBytes != 275 {
		t.Errorf("expected DownloadBytes 275, got %d", summary.TrafficMonth.DownloadBytes)
	}
	if summary.TrafficMonth.RequestCount != 15 {
		t.Errorf("expected RequestCount 15, got %d", summary.TrafficMonth.RequestCount)
	}
}

func TestGetPricingModelUnknownProvider(t *testing.T) {
	pricing := GetPricingModel("unknown-provider")

	if pricing.Provider != "unknown-provider" {
		t.Errorf("expected provider 'unknown-provider', got %s", pricing.Provider)
	}
	// Unknown providers should have zero costs
	if pricing.StorageRate != 0 || pricing.DownloadRate != 0 || pricing.UploadRate != 0 || pricing.RequestRate != 0 {
		t.Error("expected zero rates for unknown provider")
	}
	if pricing.Currency != "USD" {
		t.Errorf("expected USD currency, got %s", pricing.Currency)
	}
}

// --- Test Helpers ---

func floatClose(a, b, tolerance float64) bool {
	diff := a - b
	if diff < 0 {
		diff = -diff
	}
	return diff < tolerance
}

// --- Mock Store ---

type mockStore struct {
	records []UsageRecord
}

func (m *mockStore) RecordUsage(ctx context.Context, provider string, upload, download int64, requests int) error {
	m.records = append(m.records, UsageRecord{
		Date:          time.Now().Format("2006-01-02"),
		Provider:      provider,
		UploadBytes:   upload,
		DownloadBytes: download,
		RequestCount:  int64(requests),
	})
	return nil
}

func (m *mockStore) GetUsage(ctx context.Context, start, end time.Time) ([]UsageRecord, error) {
	return m.records, nil
}

func (m *mockStore) GetDailyUsage(ctx context.Context, date time.Time) ([]UsageRecord, error) {
	return m.records, nil
}

func (m *mockStore) Init() error {
	return nil
}

var _ Store = (*mockStore)(nil)
