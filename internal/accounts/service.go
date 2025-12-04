package accounts

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

// Service orchestrates account CRUD, encryption, and provider probing.
type Service struct {
	store  Store
	cipher security.Cipher
	dialer providers.Dialer

	activeID string
}

// NewService wires dependencies for account management.
func NewService(store Store, cipher security.Cipher, dialer providers.Dialer) *Service {
	return &Service{store: store, cipher: cipher, dialer: dialer}
}

// ListAccounts returns sanitized account views.
func (s *Service) ListAccounts(ctx context.Context) ([]Account, error) {
	records, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]Account, 0, len(records))
	for _, rec := range records {
		result = append(result, toAccount(rec))
	}
	return result, nil
}

// CreateAccount persists a new account with encrypted secret.
func (s *Service) CreateAccount(ctx context.Context, input CreateAccountInput) (Account, error) {
	if err := validateCreateInput(input); err != nil {
		return Account{}, err
	}
	now := time.Now().UTC()
	provider := input.Provider
	if provider == "" {
		provider = types.ProviderCustom
	}
	encryptedSecret, err := s.cipher.EncryptString(ctx, input.SecretAccessKey)
	if err != nil {
		return Account{}, fmt.Errorf("encrypt secret: %w", err)
	}
	record := StorageAccount{
		ID:              uuid.NewString(),
		Name:            strings.TrimSpace(input.Name),
		Provider:        provider,
		Endpoint:        strings.TrimSpace(input.Endpoint),
		AccessKeyID:     strings.TrimSpace(input.AccessKeyID),
		EncryptedSecret: encryptedSecret,
		Region:          strings.TrimSpace(input.Region),
		UseSSL:          input.UseSSL,
		Port:            input.Port,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.store.Save(ctx, record); err != nil {
		return Account{}, err
	}
	return toAccount(record), nil
}

// UpdateAccount mutates existing account fields.
func (s *Service) UpdateAccount(ctx context.Context, id string, input UpdateAccountInput) (Account, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return Account{}, err
	}
	if input.Name != nil {
		record.Name = strings.TrimSpace(*input.Name)
	}
	if input.Endpoint != nil {
		record.Endpoint = strings.TrimSpace(*input.Endpoint)
	}
	if input.AccessKeyID != nil {
		record.AccessKeyID = strings.TrimSpace(*input.AccessKeyID)
	}
	if input.SecretAccessKey != nil {
		encryptedSecret, err := s.cipher.EncryptString(ctx, *input.SecretAccessKey)
		if err != nil {
			return Account{}, fmt.Errorf("encrypt secret: %w", err)
		}
		record.EncryptedSecret = encryptedSecret
	}
	if input.Region != nil {
		record.Region = strings.TrimSpace(*input.Region)
	}
	if input.UseSSL != nil {
		record.UseSSL = *input.UseSSL
	}
	if input.Port != nil {
		record.Port = *input.Port
	}
	record.UpdatedAt = time.Now().UTC()
	if err := s.store.Update(ctx, record); err != nil {
		return Account{}, err
	}
	return toAccount(record), nil
}

// DeleteAccount removes the given account.
func (s *Service) DeleteAccount(ctx context.Context, id string) error {
	if s.activeID == id {
		s.activeID = ""
	}
	return s.store.Delete(ctx, id)
}

// SetActiveAccount marks the provided account as active.
func (s *Service) SetActiveAccount(ctx context.Context, id string) (Account, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return Account{}, err
	}
	s.activeID = id
	return toAccount(record), nil
}

// ActiveAccount returns actives account if any.
func (s *Service) ActiveAccount(ctx context.Context) (*Account, error) {
	if s.activeID == "" {
		return nil, nil
	}
	record, err := s.store.Get(ctx, s.activeID)
	if err != nil {
		return nil, err
	}
	acc := toAccount(record)
	return &acc, nil
}

// TestConnection verifies provider credentials via injected dialer.
func (s *Service) TestConnection(ctx context.Context, id string) (ConnectionTestResult, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return ConnectionTestResult{}, err
	}
	creds, err := s.credentialsFromRecord(ctx, record)
	if err != nil {
		return ConnectionTestResult{}, err
	}
	status := "ok"
	message := "connection verified"
	if err := s.dialer.TestConnection(ctx, creds); err != nil {
		status = "error"
		message = err.Error()
	}
	return ConnectionTestResult{
		AccountID: record.ID,
		Provider:  record.Provider,
		Status:    status,
		Message:   message,
		CheckedAt: time.Now().UTC(),
	}, nil
}

// EnsureSeed inserts sample accounts if none exist, aiding early UI integration.
func (s *Service) EnsureSeed(ctx context.Context) error {
	count, err := s.store.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	samples := []CreateAccountInput{
		{
			Name:            "AWS 主账户",
			Provider:        types.ProviderAWS,
			Endpoint:        "https://s3.amazonaws.com",
			AccessKeyID:     "AKIA-PLACEHOLDER",
			SecretAccessKey: "aws-secret",
			Region:          "us-east-1",
			UseSSL:          true,
			Port:            443,
		},
		{
			Name:            "阿里云杭州",
			Provider:        types.ProviderOSS,
			Endpoint:        "https://oss-cn-hangzhou.aliyuncs.com",
			AccessKeyID:     "LTAI-PLACEHOLDER",
			SecretAccessKey: "oss-secret",
			Region:          "cn-hangzhou",
			UseSSL:          true,
			Port:            443,
		},
	}
	for _, sample := range samples {
		if _, err := s.CreateAccount(ctx, sample); err != nil {
			return err
		}
	}
	return nil
}

// ConnectionCredentials resolves decrypted credentials for the given account.
func (s *Service) ConnectionCredentials(ctx context.Context, id string) (providers.ConnectionCredentials, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return providers.ConnectionCredentials{}, err
	}
	return s.credentialsFromRecord(ctx, record)
}

func validateCreateInput(input CreateAccountInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("name is required")
	}
	if strings.TrimSpace(input.Endpoint) == "" {
		return errors.New("endpoint is required")
	}
	if strings.TrimSpace(input.AccessKeyID) == "" {
		return errors.New("access key id is required")
	}
	if strings.TrimSpace(input.SecretAccessKey) == "" {
		return errors.New("secret access key is required")
	}
	return nil
}

func (s *Service) credentialsFromRecord(ctx context.Context, record StorageAccount) (providers.ConnectionCredentials, error) {
	secret, err := s.cipher.DecryptString(ctx, record.EncryptedSecret)
	if err != nil {
		return providers.ConnectionCredentials{}, fmt.Errorf("decrypt secret: %w", err)
	}
	return providers.ConnectionCredentials{
		Provider:        record.Provider,
		Endpoint:        record.Endpoint,
		AccessKeyID:     record.AccessKeyID,
		SecretAccessKey: secret,
		Region:          record.Region,
		UseSSL:          record.UseSSL,
		Port:            record.Port,
	}, nil
}

func toAccount(record StorageAccount) Account {
	return Account{
		ID:               record.ID,
		Name:             record.Name,
		Provider:         record.Provider,
		ProviderLabel:    record.Provider.Label(),
		Endpoint:         record.Endpoint,
		Region:           record.Region,
		UseSSL:           record.UseSSL,
		Port:             record.Port,
		AccessKeyPreview: maskAccessKey(record.AccessKeyID),
		HasSecret:        record.EncryptedSecret != "",
		CreatedAt:        record.CreatedAt,
		UpdatedAt:        record.UpdatedAt,
	}
}

func maskAccessKey(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 4 {
		return trimmed
	}
	return trimmed[:4] + "***" + trimmed[len(trimmed)-2:]
}
