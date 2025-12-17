package accounts

import (
	"time"

	"gorm.io/datatypes"

	"can/internal/types"
)

// Extra is a type alias for JSON map storing provider-specific params.
type Extra = datatypes.JSONMap

// accountRecord is the persisted representation containing encrypted secrets.
type accountRecord struct {
	ID              string         `json:"id" gorm:"primaryKey;size:64"`
	Name            string         `json:"name" gorm:"size:128;index"`
	Tag             string         `json:"tag" gorm:"size:64"`
	Provider        types.Provider `json:"provider" gorm:"size:32;index"`
	Endpoint        string         `json:"endpoint" gorm:"size:512"`
	AccessKeyID     string         `json:"accessKeyId" gorm:"size:256"`
	EncryptedSecret string         `json:"encryptedSecret" gorm:"type:text"`
	Region          string         `json:"region" gorm:"size:64"`
	Extra           Extra          `json:"extra" gorm:"type:text;default:'{}'"` // JSON for provider-specific params
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
	CreatedAt       time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
}

// GetExtra returns the extra map, ensuring it's never nil.
func (r *accountRecord) GetExtra() map[string]any {
	if r.Extra == nil {
		return make(map[string]any)
	}
	return r.Extra
}

// GetExtraString returns a string value from extra params.
func (r *accountRecord) GetExtraString(key string) string {
	if r.Extra == nil {
		return ""
	}
	v, ok := r.Extra[key]
	if !ok {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// TableName overrides the default table for GORM to keep naming explicit.
func (accountRecord) TableName() string {
	return "accounts"
}

// Account is the sanitized DTO returned to the frontend.
type Account struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Tag              string            `json:"tag"`
	Provider         types.Provider    `json:"provider"`
	ProviderLabel    string            `json:"providerLabel"`
	Endpoint         string            `json:"endpoint"`
	Region           string            `json:"region"`
	Extra            map[string]string `json:"extra"` // Provider-specific params
	UseSSL           bool              `json:"useSSL"`
	Port             int               `json:"port"`
	AccessKeyPreview string            `json:"accessKeyPreview"`
	HasSecret        bool              `json:"hasSecret"`
	CreatedAt        time.Time         `json:"createdAt" ts_type:"string"`
	UpdatedAt        time.Time         `json:"updatedAt" ts_type:"string"`
}

// CreateAccountInput captures data needed to create a new account.
type CreateAccountInput struct {
	Name            string            `json:"name" validate:"required"`
	Tag             string            `json:"tag"`
	Provider        types.Provider    `json:"provider"`
	Endpoint        string            `json:"endpoint" validate:"required"`
	AccessKeyID     string            `json:"accessKeyId" validate:"required"`
	SecretAccessKey string            `json:"secretAccessKey" validate:"required"`
	Region          string            `json:"region"`
	Extra           map[string]string `json:"extra"` // Provider-specific params (e.g., {"appId": "..."} for COS)
	UseSSL          bool              `json:"useSSL"`
	Port            int               `json:"port"`
}

// UpdateAccountInput represents optional fields for account updates.
type UpdateAccountInput struct {
	Provider        types.Provider    `json:"provider"`
	Name            string            `json:"name" validate:"omitempty,min=1"`
	Tag             string            `json:"tag"`
	Endpoint        string            `json:"endpoint" validate:"omitempty,min=1"`
	AccessKeyID     string            `json:"accessKeyId" validate:"omitempty,min=1"`
	SecretAccessKey string            `json:"secretAccessKey" validate:"omitempty,min=1"`
	Region          string            `json:"region"`
	Extra           map[string]string `json:"extra"` // Provider-specific params
	UseSSL          bool              `json:"useSSL"`
	Port            int               `json:"port"`
}

// DialResult summarizes a connectivity check outcome.
type DialResult struct {
	AccountID string         `json:"accountId"`
	Provider  types.Provider `json:"provider"`
	Status    string         `json:"status"`
	Message   string         `json:"message"`
	Buckets   []string       `json:"buckets"`
	CheckedAt time.Time      `json:"checkedAt" ts_type:"string"`
}

// ExportData represents the serialized file payload for account backups.
type ExportData struct {
	Blob  []byte `json:"-"`
	Count int    `json:"count"`
}

// ExportSummary describes the result of writing an export file via the desktop app.
type ExportSummary struct {
	FilePath  string `json:"filePath"`
	Count     int    `json:"count"`
	Cancelled bool   `json:"cancelled"`
}

// ImportResult captures service-level stats from restoring an export bundle.
type ImportResult struct {
	Total    int      `json:"total"`
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Failed   int      `json:"failed"`
	Issues   []string `json:"issues"`
}

// ImportSummary is returned to the UI after reading a bundle from disk.
type ImportSummary struct {
	FilePath  string   `json:"filePath"`
	Total     int      `json:"total"`
	Imported  int      `json:"imported"`
	Skipped   int      `json:"skipped"`
	Failed    int      `json:"failed"`
	Issues    []string `json:"issues"`
	Cancelled bool     `json:"cancelled"`
}

// BatchImportInput represents a single account entry for CSV/JSON batch import (plaintext format).
type BatchImportInput struct {
	Name            string `json:"name" validate:"required"`
	Tag             string `json:"tag"`
	Provider        string `json:"provider"`
	Endpoint        string `json:"endpoint" validate:"required"`
	Region          string `json:"region"`
	UseSSL          bool   `json:"useSSL"`
	Port            int    `json:"port"`
	AccessKeyID     string `json:"accessKeyId" validate:"required"`
	SecretAccessKey string `json:"secretAccessKey" validate:"required"`
}

// BatchImportError describes a single record import failure.
type BatchImportError struct {
	Index   int    `json:"index"`   // Record index (1-based)
	Name    string `json:"name"`    // Account name (if parseable)
	Field   string `json:"field"`   // Field that caused the error (optional)
	Message string `json:"message"` // Error message
}

// BatchImportResult captures the outcome of batch importing accounts.
type BatchImportResult struct {
	Total    int                `json:"total"`    // Total record count
	Imported int                `json:"imported"` // Successfully imported
	Skipped  int                `json:"skipped"`  // Skipped (duplicates)
	Failed   int                `json:"failed"`   // Failed count
	Errors   []BatchImportError `json:"errors"`   // Failure details
}

// BatchImportSummary is returned to the frontend after batch import.
type BatchImportSummary struct {
	Total     int                `json:"total"`
	Imported  int                `json:"imported"`
	Skipped   int                `json:"skipped"`
	Failed    int                `json:"failed"`
	Errors    []BatchImportError `json:"errors"`
	Cancelled bool               `json:"cancelled"`
}
