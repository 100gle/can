package accounts

import (
	"time"

	"can/internal/types"
)

// StorageAccount is the persisted representation containing encrypted secrets.
type StorageAccount struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Provider        types.Provider `json:"provider"`
	Endpoint        string         `json:"endpoint"`
	AccessKeyID     string         `json:"accessKeyId"`
	EncryptedSecret string         `json:"encryptedSecret"`
	Region          string         `json:"region"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
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
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
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
	Name            *string `json:"name"`
	Endpoint        *string `json:"endpoint"`
	AccessKeyID     *string `json:"accessKeyId"`
	SecretAccessKey *string `json:"secretAccessKey"`
	Region          *string `json:"region"`
	UseSSL          *bool   `json:"useSSL"`
	Port            *int    `json:"port"`
}

// ConnectionTestResult summarizes a connectivity check outcome.
type ConnectionTestResult struct {
	AccountID string         `json:"accountId"`
	Provider  types.Provider `json:"provider"`
	Status    string         `json:"status"`
	Message   string         `json:"message"`
	CheckedAt time.Time      `json:"checkedAt"`
}
