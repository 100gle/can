package system

import "time"

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

// PingResult summarises the outcome of a lightweight network reachability check.
type PingResult struct {
	URL        string    `json:"url"`
	Method     string    `json:"method"`
	Online     bool      `json:"online"`
	StatusCode int       `json:"statusCode"`
	CheckedAt  time.Time `json:"checkedAt" ts_type:"string"`
	LatencyMs  int64     `json:"latencyMs"`
	ResolvedIP string    `json:"resolvedIp"`
	Reason     string    `json:"reason"`
	Error      string    `json:"error"`
}
