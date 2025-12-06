package analytics

// PricingModel defines the cost rates for a provider.
type PricingModel struct {
	Provider     string  `json:"provider"`
	StorageRate  float64 `json:"storageRate"`  // per GB per month
	DownloadRate float64 `json:"downloadRate"` // per GB
	UploadRate   float64 `json:"uploadRate"`   // per GB (often 0)
	RequestRate  float64 `json:"requestRate"`  // per 1000 requests
	Currency     string  `json:"currency"`
}

// TrafficStats represents aggregated traffic data for a period.
type TrafficStats struct {
	UploadBytes   int64 `json:"uploadBytes"`
	DownloadBytes int64 `json:"downloadBytes"`
	RequestCount  int64 `json:"requestCount"`
}

// CostEstimate represents calculated costs.
type CostEstimate struct {
	StorageCost float64 `json:"storageCost"`
	TrafficCost float64 `json:"trafficCost"`
	RequestCost float64 `json:"requestCost"`
	TotalCost   float64 `json:"totalCost"`
	Currency    string  `json:"currency"`
}

// UsageRecord represents a single usage event or aggregated daily record.
type UsageRecord struct {
	Date          string `json:"date"` // YYYY-MM-DD
	Provider      string `json:"provider"`
	UploadBytes   int64  `json:"uploadBytes"`
	DownloadBytes int64  `json:"downloadBytes"`
	RequestCount  int64  `json:"requestCount"`
}

// AnalyticsSummary returns the summary for dashboard.
type AnalyticsSummary struct {
	TrafficToday TrafficStats `json:"trafficToday"`
	TrafficMonth TrafficStats `json:"trafficMonth"`
	CostMonth    CostEstimate `json:"costMonth"`
}
