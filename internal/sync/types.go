package sync

import (
	"context"
	"time"
)

// SyncDirection defines the direction of synchronization.
type SyncDirection string

const (
	SyncLocalToRemote SyncDirection = "upload"
	SyncRemoteToLocal SyncDirection = "download"
	SyncBidirectional SyncDirection = "bidirectional"
)

// SyncRule defines a synchronization rule between a local path and a remote bucket/prefix.
type SyncRule struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	AccountID   string        `json:"accountId"`
	Bucket      string        `json:"bucket"`
	Prefix      string        `json:"prefix"`
	LocalPath   string        `json:"localPath"`
	Direction   SyncDirection `json:"direction"`
	Interval    int           `json:"interval"` // in seconds, 0 for manual/once
	LastSync    time.Time     `json:"lastSync" ts_type:"string"`
	NextSync    time.Time     `json:"nextSync" ts_type:"string"`
	Enabled     bool          `json:"enabled"`
	ExcludeGlob []string      `json:"excludeGlob"`
}

// SyncTask represents an execution instance of a SyncRule.
type SyncTask struct {
	ID        string    `json:"id"`
	RuleID    string    `json:"ruleId"`
	Status    string    `json:"status"` // pending, running, completed, partly_failed, failed
	StartTime time.Time `json:"startTime" ts_type:"string"`
	EndTime   time.Time `json:"endTime" ts_type:"string"`
	Added     int64     `json:"added"`
	Updated   int64     `json:"updated"`
	Deleted   int64     `json:"deleted"`
	Errors    []string  `json:"errors"`
}

// Service defines the interface for the sync engine.
type Service interface {
	CreateRule(ctx context.Context, rule *SyncRule) error
	UpdateRule(ctx context.Context, rule *SyncRule) error
	DeleteRule(ctx context.Context, id string) error
	ListRules(ctx context.Context) ([]*SyncRule, error)
	GetRule(ctx context.Context, id string) (*SyncRule, error)

	StartSync(ctx context.Context, ruleID string) (*SyncTask, error)
	StopSync(ctx context.Context, ruleID string) error
	ListTasks(ctx context.Context, ruleID string) ([]*SyncTask, error)
}
