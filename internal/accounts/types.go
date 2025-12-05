package accounts

import (
	"time"

	"can/internal/types"
)

// StorageAccount is the persisted representation containing encrypted secrets.
type StorageAccount struct {
	ID              string         `json:"id" gorm:"primaryKey;size:64"`
	Name            string         `json:"name" gorm:"size:128;index"`
	Provider        types.Provider `json:"provider" gorm:"size:32;index"`
	Endpoint        string         `json:"endpoint" gorm:"size:512"`
	AccessKeyID     string         `json:"accessKeyId" gorm:"size:256"`
	EncryptedSecret string         `json:"encryptedSecret" gorm:"type:text"`
	Region          string         `json:"region" gorm:"size:64"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
	CreatedAt       time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
}

// TableName overrides the default table for GORM to keep naming explicit.
func (StorageAccount) TableName() string {
	return "accounts"
}

// Account is the sanitized DTO returned to the frontend.
type Account struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	Provider         types.Provider `json:"provider"`
	ProviderLabel    string         `json:"providerLabel"`
	Endpoint         string         `json:"endpoint"`
	Region           string         `json:"region"`
	UseSSL           bool           `json:"useSSL"`
	Port             int            `json:"port"`
	AccessKeyPreview string         `json:"accessKeyPreview"`
	HasSecret        bool           `json:"hasSecret"`
	CreatedAt        time.Time      `json:"createdAt" ts_type:"string"`
	UpdatedAt        time.Time      `json:"updatedAt" ts_type:"string"`
}

// CreateAccountInput captures data needed to create a new account.
type CreateAccountInput struct {
	Name            string         `json:"name"`
	Provider        types.Provider `json:"provider"`
	Endpoint        string         `json:"endpoint"`
	AccessKeyID     string         `json:"accessKeyId"`
	SecretAccessKey string         `json:"secretAccessKey"`
	Region          string         `json:"region"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
}

// UpdateAccountInput represents optional fields for account updates.
type UpdateAccountInput struct {
	Provider        *types.Provider `json:"provider"`
	Name            *string         `json:"name"`
	Endpoint        *string         `json:"endpoint"`
	AccessKeyID     *string         `json:"accessKeyId"`
	SecretAccessKey *string         `json:"secretAccessKey"`
	Region          *string         `json:"region"`
	UseSSL          *bool           `json:"useSSL"`
	Port            *int            `json:"port"`
}

// ConnectionTestResult summarizes a connectivity check outcome.
type ConnectionTestResult struct {
	AccountID string         `json:"accountId"`
	Provider  types.Provider `json:"provider"`
	Status    string         `json:"status"`
	Message   string         `json:"message"`
	CheckedAt time.Time      `json:"checkedAt" ts_type:"string"`
}

// ExportData represents the serialized file payload for account backups.
type ExportData struct {
	Blob       []byte    `json:"-"`
	Count      int       `json:"count"`
	Cipher     string    `json:"cipher"`
	Version    string    `json:"version"`
	ExportedAt time.Time `json:"exportedAt" ts_type:"string"`
}

// ExportSummary describes the result of writing an export file via the desktop app.
type ExportSummary struct {
	FilePath  string `json:"filePath"`
	Count     int    `json:"count"`
	Cipher    string `json:"cipher"`
	Version   string `json:"version"`
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
