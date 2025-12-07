package security

import (
	"context"
	"time"
)

// AuditEvent represents a sensitive operation entry.
type AuditEvent struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Timestamp time.Time `json:"timestamp"`
	User      string    `json:"user"`     // User ID or Access Key
	Action    string    `json:"action"`   // e.g. "DeleteObject", "PutBucketPolicy"
	Resource  string    `json:"resource"` // e.g. "bucket-name/key"
	Status    string    `json:"status"`   // "Success" or "Failure"
	Details   string    `json:"details"`  // Optional JSON details
	ClientIP  string    `json:"clientIP"`
}

// AuditStore defines persistence for audit logs.
type AuditStore interface {
	Record(ctx context.Context, event AuditEvent) error
	Query(ctx context.Context, filter AuditFilter) ([]AuditEvent, error)
	Init() error
}

// AuditFilter captures query parameters.
type AuditFilter struct {
	StartTime *time.Time
	EndTime   *time.Time
	Action    string
	Resource  string
	Limit     int
	Offset    int
}

// Service manages audit logging.
type Service struct {
	store AuditStore
}

func NewService(store AuditStore) *Service {
	return &Service{store: store}
}

func (s *Service) Log(ctx context.Context, action, resource, user, status string, details string) error {
	event := AuditEvent{
		Timestamp: time.Now(),
		Action:    action,
		Resource:  resource,
		User:      user,
		Status:    status,
		Details:   details,
	}
	return s.store.Record(ctx, event)
}

func (s *Service) GetLogs(ctx context.Context, filter AuditFilter) ([]AuditEvent, error) {
	return s.store.Query(ctx, filter)
}
