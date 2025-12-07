package system

import "time"

type SystemMetrics struct {
	Timestamp       time.Time `json:"timestamp" ts_type:"string"`
	MemoryAlloc     uint64    `json:"memoryAlloc"` // Bytes allocated and not yet freed
	MemoryTotal     uint64    `json:"memoryTotal"` // Total bytes allocated (cumulative)
	MemorySys       uint64    `json:"memorySys"`   // Bytes obtained from system
	NumGoroutines   int       `json:"numGoroutines"`
	NumCgoCalls     int64     `json:"numCgoCalls"`
	ActiveTransfers int       `json:"activeTransfers"` // Supplied by TransferService
}

// UpdateInfo captures the latest release metadata compared with the running build.
type UpdateInfo struct {
	CurrentVersion  string    `json:"currentVersion"`
	LatestVersion   string    `json:"latestVersion"`
	UpdateAvailable bool      `json:"updateAvailable"`
	ReleaseURL      string    `json:"releaseURL"`
	ReleaseNotes    string    `json:"releaseNotes"`
	PublishedAt     time.Time `json:"publishedAt" ts_type:"string"`
	IsPrerelease    bool      `json:"isPrerelease"`
}
