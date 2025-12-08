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
	Origin    string    `json:"origin" gorm:"size:64"`
	RequestID string    `json:"requestId" gorm:"size:128;index"`
}

// AuditStore defines persistence for audit logs.
type AuditStore interface {
	Record(ctx context.Context, event AuditEvent) error
	Query(ctx context.Context, filter AuditFilter) ([]AuditEvent, error)
	Init() error
	HasRequest(ctx context.Context, requestID string) (bool, error)
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

// LogOption customises audit entries at call sites (origin, request IDs, etc.).
type LogOption func(event *AuditEvent)

// WithOrigin annotates the audit event with a custom origin (e.g. "offline-queue").
func WithOrigin(origin string) LogOption {
	return func(event *AuditEvent) {
		if event != nil {
			event.Origin = origin
		}
	}
}

// WithRequestID associates an idempotency token with the audit entry.
func WithRequestID(requestID string) LogOption {
	return func(event *AuditEvent) {
		if event != nil {
			event.RequestID = requestID
		}
	}
}

func (s *Service) Log(ctx context.Context, action, resource, user, status string, details string, opts ...LogOption) error {
	event := AuditEvent{
		Timestamp: time.Now(),
		Action:    action,
		Resource:  resource,
		User:      user,
		Status:    status,
		Details:   details,
	}
	for _, opt := range opts {
		if opt != nil {
			opt(&event)
		}
	}
	return s.store.Record(ctx, event)
}

func (s *Service) GetLogs(ctx context.Context, filter AuditFilter) ([]AuditEvent, error) {
	return s.store.Query(ctx, filter)
}

// HasRequest reports whether a previous audit entry already recorded the given request ID with a successful status.
func (s *Service) HasRequest(ctx context.Context, requestID string) (bool, error) {
	if s == nil || s.store == nil {
		return false, nil
	}
	return s.store.HasRequest(ctx, requestID)
}
