package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/types"
)

const exportFormatVersion = "can.accounts/v1"

type exportEnvelope struct {
	FormatVersion string    `json:"formatVersion"`
	Cipher        string    `json:"cipher"`
	ExportedAt    time.Time `json:"exportedAt" ts_type:"string"`
	Count         int       `json:"count"`
	Payload       string    `json:"payload"`
}

type exportPayload struct {
	Accounts []exportAccount `json:"accounts"`
}

type exportAccount struct {
	Name            string         `json:"name"`
	Tag             string         `json:"tag"`
	Provider        types.Provider `json:"provider"`
	Endpoint        string         `json:"endpoint"`
	Region          string         `json:"region"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
	AccessKeyID     string         `json:"accessKeyId"`
	SecretAccessKey string         `json:"secretAccessKey"`
}

// ExportData serializes all stored accounts into an encrypted payload ready for disk persistence.
func (s *Service) ExportData(ctx context.Context) (ExportData, error) {
	records, err := s.store.List(ctx)
	if err != nil {
		return ExportData{}, err
	}
	payload := exportPayload{Accounts: make([]exportAccount, 0, len(records))}
	for _, record := range records {
		secret, err := s.cipher.DecryptString(ctx, record.EncryptedSecret)
		if err != nil {
			return ExportData{}, fmt.Errorf("decrypt secret for %s: %w", record.Name, err)
		}
		payload.Accounts = append(payload.Accounts, exportAccount{
			Name:            record.Name,
			Tag:             record.Tag,
			Provider:        record.Provider,
			Endpoint:        record.Endpoint,
			Region:          record.Region,
			UseSSL:          record.UseSSL,
			Port:            record.Port,
			AccessKeyID:     record.AccessKeyID,
			SecretAccessKey: secret,
		})
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return ExportData{}, fmt.Errorf("marshal payload: %w", err)
	}
	encrypted, err := s.cipher.EncryptString(ctx, string(raw))
	if err != nil {
		return ExportData{}, fmt.Errorf("encrypt payload: %w", err)
	}
	envelope := exportEnvelope{
		FormatVersion: exportFormatVersion,
		Cipher:        cipherName(s.cipher),
		ExportedAt:    time.Now().UTC(),
		Count:         len(payload.Accounts),
		Payload:       encrypted,
	}
	blob, err := json.MarshalIndent(envelope, "", "  ")
	if err != nil {
		return ExportData{}, fmt.Errorf("marshal envelope: %w", err)
	}
	return ExportData{
		Blob:       blob,
		Count:      envelope.Count,
		Cipher:     envelope.Cipher,
		Version:    envelope.FormatVersion,
		ExportedAt: envelope.ExportedAt,
	}, nil
}

// ImportData restores accounts from a serialized bundle.
func (s *Service) ImportData(ctx context.Context, blob []byte) (ImportResult, error) {
	if len(blob) == 0 {
		return ImportResult{}, errors.New("空的导入文件")
	}
	var envelope exportEnvelope
	if err := json.Unmarshal(blob, &envelope); err != nil {
		return ImportResult{}, fmt.Errorf("parse export file: %w", err)
	}
	if envelope.FormatVersion != exportFormatVersion {
		return ImportResult{}, fmt.Errorf("unsupported export format: %s", envelope.FormatVersion)
	}
	decrypted, err := s.cipher.DecryptString(ctx, envelope.Payload)
	if err != nil {
		return ImportResult{}, fmt.Errorf("decrypt payload: %w", err)
	}
	var payload exportPayload
	if err := json.Unmarshal([]byte(decrypted), &payload); err != nil {
		return ImportResult{}, fmt.Errorf("parse payload: %w", err)
	}
	existing, err := s.store.List(ctx)
	if err != nil {
		return ImportResult{}, err
	}
	dedupe := make(map[string]struct{}, len(existing))
	for _, acc := range existing {
		dedupe[accountKey(acc.Name, acc.Endpoint, acc.Provider)] = struct{}{}
	}
	result := ImportResult{Total: len(payload.Accounts)}
	var firstCreated string
	for _, item := range payload.Accounts {
		key := accountKey(item.Name, item.Endpoint, item.Provider)
		if _, exists := dedupe[key]; exists {
			result.Skipped++
			result.Issues = append(result.Issues, fmt.Sprintf("账户 %s (%s) 已存在，已跳过", item.Name, item.Provider.Label()))
			continue
		}
		input := CreateAccountInput{
			Name:            strings.TrimSpace(item.Name),
			Tag:             strings.TrimSpace(item.Tag),
			Provider:        types.ParseProvider(string(item.Provider)),
			Endpoint:        strings.TrimSpace(item.Endpoint),
			AccessKeyID:     strings.TrimSpace(item.AccessKeyID),
			SecretAccessKey: strings.TrimSpace(item.SecretAccessKey),
			Region:          strings.TrimSpace(item.Region),
			UseSSL:          item.UseSSL,
			Port:            item.Port,
		}
		account, err := s.CreateAccount(ctx, input)
		if err != nil {
			result.Failed++
			result.Issues = append(result.Issues, fmt.Sprintf("导入 %s 失败: %v", item.Name, err))
			continue
		}
		dedupe[key] = struct{}{}
		result.Imported++
		if firstCreated == "" {
			firstCreated = account.ID
		}
	}
	if s.activeID == "" && firstCreated != "" {
		s.activeID = firstCreated
	}
	return result, nil
}

func accountKey(name, endpoint string, provider types.Provider) string {
	normalizedName := strings.ToLower(strings.TrimSpace(name))
	normalizedEndpoint := strings.ToLower(strings.TrimSpace(endpoint))
	return fmt.Sprintf("%s|%s|%s", normalizedName, normalizedEndpoint, string(provider))
}

func cipherName(c Cipher) string {
	switch c.(type) {
	case NoopCipher:
		return "noop"
	case *AESCipher:
		return "aes-256-gcm"
	default:
		return "unknown"
	}
}
