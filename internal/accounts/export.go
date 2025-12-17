package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"can/internal/types"
	"can/internal/validation"
)

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
	Extra           map[string]any `json:"extra,omitempty"`
}

// ExportData serializes all stored accounts into a payload ready for disk persistence.
func (s *Service) ExportData(ctx context.Context) (ExportData, error) {
	records, err := s.store.List(ctx)
	if err != nil {
		return ExportData{}, err
	}
	accounts := make([]exportAccount, 0, len(records))
	for _, record := range records {
		// Secret is stored in plain text now (in EncryptedSecret field)
		accounts = append(accounts, exportAccount{
			Name:            record.Name,
			Tag:             record.Tag,
			Provider:        record.Provider,
			Endpoint:        record.Endpoint,
			Region:          record.Region,
			UseSSL:          record.UseSSL,
			Port:            record.Port,
			AccessKeyID:     record.AccessKeyID,
			SecretAccessKey: record.EncryptedSecret,
			Extra:           record.GetExtra(),
		})
	}
	blob, err := json.MarshalIndent(accounts, "", "  ")
	if err != nil {
		return ExportData{}, fmt.Errorf("marshal accounts: %w", err)
	}
	return ExportData{
		Blob:  blob,
		Count: len(accounts),
	}, nil
}

// ImportData restores accounts from a serialized bundle.
func (s *Service) ImportData(ctx context.Context, blob []byte) (ImportResult, error) {
	if len(blob) == 0 {
		return ImportResult{}, errors.New("空的导入文件")
	}
	var accounts []exportAccount
	if err := json.Unmarshal(blob, &accounts); err != nil {
		return ImportResult{}, fmt.Errorf("parse accounts: %w", err)
	}
	existing, err := s.store.List(ctx)
	if err != nil {
		return ImportResult{}, err
	}
	dedupe := make(map[string]struct{}, len(existing))
	for _, acc := range existing {
		dedupe[accountKey(acc.Name, acc.Endpoint, acc.Provider)] = struct{}{}
	}
	result := ImportResult{Total: len(accounts)}
	var firstCreated string
	for _, item := range accounts {
		key := accountKey(item.Name, item.Endpoint, item.Provider)
		if _, exists := dedupe[key]; exists {
			result.Skipped++
			result.Issues = append(result.Issues, fmt.Sprintf("账户 %s (%s) 已存在，已跳过", item.Name, item.Provider.Label()))
			continue
		}
		// Convert map[string]any to map[string]string for CreateAccountInput
		extraParams := make(map[string]string)
		for k, v := range item.Extra {
			if strVal, ok := v.(string); ok {
				extraParams[k] = strVal
			}
		}

		input := CreateAccountInput{
			Name:            item.Name,
			Tag:             item.Tag,
			Provider:        types.ParseProvider(string(item.Provider)),
			Endpoint:        item.Endpoint,
			AccessKeyID:     item.AccessKeyID,
			SecretAccessKey: item.SecretAccessKey,
			Region:          item.Region,
			Extra:           extraParams,
			UseSSL:          item.UseSSL,
			Port:            item.Port,
		}
		if err := validation.ValidateStruct(input); err != nil {
			result.Failed++
			result.Issues = append(result.Issues, fmt.Sprintf("导入 %s 失败: %v", item.Name, err))
			continue
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
