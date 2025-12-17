package accounts

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"can/internal/storage"
	"can/internal/types"

	"github.com/google/uuid"
)

// Service orchestrates account CRUD, encryption, and provider probing.
type Service struct {
	store       Store
	buildClient func(context.Context, storage.ClientRecord) (*storage.Client, error)
	activeID    string

	mu sync.RWMutex
}

// NewService wires dependencies for account management.
func NewService(store Store) *Service {
	return &Service{
		store: store,
		buildClient: func(ctx context.Context, record storage.ClientRecord) (*storage.Client, error) {
			return storage.NewClient(ctx, record)
		},
	}
}

func (s *Service) clientBuilder() func(context.Context, storage.ClientRecord) (*storage.Client, error) {
	if s.buildClient != nil {
		return s.buildClient
	}
	return func(ctx context.Context, record storage.ClientRecord) (*storage.Client, error) {
		return storage.NewClient(ctx, record)
	}
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
	now := time.Now().UTC()
	provider := input.Provider
	if provider == "" {
		provider = types.ProviderCustom
	}
	record := accountRecord{
		ID:              uuid.NewString(),
		Name:            input.Name,
		Tag:             input.Tag,
		Provider:        provider,
		Endpoint:        input.Endpoint,
		AccessKeyID:     input.AccessKeyID,
		EncryptedSecret: input.SecretAccessKey,
		Region:          input.Region,
		Extra:           toJSON(input.Extra),
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
	if input.Provider != "" {
		record.Provider = input.Provider
	}
	if input.Name != "" {
		record.Name = input.Name
	}
	if input.Tag != "" {
		record.Tag = input.Tag
	}
	if input.Endpoint != "" {
		record.Endpoint = input.Endpoint
	}
	if input.AccessKeyID != "" {
		record.AccessKeyID = input.AccessKeyID
	}
	if input.SecretAccessKey != "" {
		record.EncryptedSecret = input.SecretAccessKey
	}
	if input.Region != "" {
		record.Region = input.Region
	}
	if len(input.Extra) > 0 {
		// Merge incoming extra params with existing ones
		existing := record.GetExtra()
		for k, v := range input.Extra {
			existing[k] = v
		}
		record.Extra = existing
	}
	// Note: We cannot distinguish between "false" and "unset" for bool without a pointer.
	// We assume that the caller provides the desired state.
	record.UseSSL = input.UseSSL
	if input.Port != 0 {
		record.Port = input.Port
	}
	record.UpdatedAt = time.Now().UTC()
	if err := s.store.Update(ctx, record); err != nil {
		return Account{}, err
	}
	return toAccount(record), nil
}

// DeleteAccount removes the given account.
func (s *Service) DeleteAccount(ctx context.Context, id string) error {
	s.mu.Lock()
	if s.activeID == id {
		s.activeID = ""
	}
	s.mu.Unlock()
	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	return nil
}

// SetActiveAccount marks the provided account as active.
func (s *Service) SetActiveAccount(ctx context.Context, id string) (Account, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return Account{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activeID = id
	return toAccount(record), nil
}

// ActiveAccount returns actives account if any.
func (s *Service) ActiveAccount(ctx context.Context) (*Account, error) {
	s.mu.RLock()
	activeID := s.activeID
	s.mu.RUnlock()
	if activeID == "" {
		return nil, nil
	}
	record, err := s.store.Get(ctx, activeID)
	if err != nil {
		s.mu.Lock()
		if s.activeID == activeID {
			s.activeID = ""
		}
		s.mu.Unlock()
		return nil, err
	}
	acc := toAccount(record)
	return &acc, nil
}

// AccountProvider returns the provider for the requested account without decrypting secrets.
func (s *Service) AccountProvider(ctx context.Context, id string) (types.Provider, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return types.ProviderCustom, err
	}
	return record.Provider, nil
}

// Dial verifies provider credentials via injected dialer.
func (s *Service) Dial(ctx context.Context, id string) (DialResult, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return DialResult{}, err
	}
	creds, err := s.credentialsFromRecord(ctx, record)
	if err != nil {
		return DialResult{}, err
	}
	clientRecord := clientRecordFromAccount(record, creds)
	status := "ok"
	message := "connection verified"

	client, err := s.clientBuilder()(ctx, clientRecord)
	if err != nil {
		return DialResult{}, err
	}

	buckets, err := client.Dial(ctx)
	if err != nil {
		status = "error"
		message = err.Error()
	}

	return DialResult{
		AccountID: record.ID,
		Provider:  record.Provider,
		Status:    status,
		Message:   message,
		Buckets:   buckets,
		CheckedAt: time.Now().UTC(),
	}, nil
}

// DialWithInput verifies credentials that have not been persisted yet.
func (s *Service) DialWithInput(ctx context.Context, input CreateAccountInput) (DialResult, error) {
	creds := credentialsFromInput(input)
	clientRecord := clientRecordFromInput(creds)
	status := "ok"
	message := "connection verified"

	client, err := s.clientBuilder()(ctx, clientRecord)
	if err != nil {
		return DialResult{}, err
	}

	buckets, err := client.Dial(ctx)
	if err != nil {
		status = "error"
		message = err.Error()
	}

	return DialResult{
		AccountID: "",
		Provider:  creds.Provider,
		Status:    status,
		Message:   message,
		Buckets:   buckets,
		CheckedAt: time.Now().UTC(),
	}, nil
}

// Credentials resolves decrypted credentials for the given account.
func (s *Service) Credentials(ctx context.Context, id string) (storage.Credentials, error) {
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return storage.Credentials{}, err
	}
	return s.credentialsFromRecord(ctx, record)
}

// GetClient builds or refreshes a storage Client via the provided vault.
// It mirrors the account record into the clients table (ID aligned) before constructing the client.
func (s *Service) GetClient(ctx context.Context, vault *storage.ClientVault, accountID string) (*storage.Client, error) {
	if accountID == "" {
		return nil, errors.New("account id is required")
	}
	if vault == nil {
		return nil, errors.New("client vault not configured")
	}
	record, err := s.store.Get(ctx, accountID)
	if err != nil {
		return nil, err
	}
	creds, err := s.credentialsFromRecord(ctx, record)
	if err != nil {
		return nil, err
	}
	clientRecord := clientRecordFromAccount(record, creds)
	if _, err := vault.Upsert(ctx, clientRecord); err != nil {
		return nil, err
	}
	return vault.Get(ctx, clientRecord.ID)
}

// SyncClients mirrors all account records into the storage clients vault.
// It is idempotent and safe to run during startup to ensure the clients table is populated.
func (s *Service) SyncClients(ctx context.Context, vault *storage.ClientVault) error {
	if vault == nil {
		return errors.New("client vault not configured")
	}
	records, err := s.store.List(ctx)
	if err != nil {
		return err
	}
	for _, record := range records {
		creds, err := s.credentialsFromRecord(ctx, record)
		if err != nil {
			return err
		}
		clientRecord := clientRecordFromAccount(record, creds)
		if _, err := vault.Upsert(ctx, clientRecord); err != nil {
			return err
		}
	}
	return nil
}

func credentialsFromInput(input CreateAccountInput) storage.Credentials {
	provider := input.Provider
	if provider == "" {
		provider = types.ProviderCustom
	}
	return storage.Credentials{
		Provider:        provider,
		Endpoint:        input.Endpoint,
		AccessKeyID:     input.AccessKeyID,
		SecretAccessKey: input.SecretAccessKey,
		Region:          input.Region,
		UseSSL:          input.UseSSL,
		Port:            input.Port,
	}
}

func clientRecordFromAccount(record accountRecord, creds storage.Credentials) storage.ClientRecord {
	return storage.ClientRecord{
		ID:              record.ID,
		Name:            record.Name,
		Tag:             record.Tag,
		Provider:        record.Provider,
		Endpoint:        record.Endpoint,
		Region:          record.Region,
		UseSSL:          record.UseSSL,
		Port:            record.Port,
		AccessKeyID:     creds.AccessKeyID,
		SecretAccessKey: creds.SecretAccessKey,
		SessionToken:    "",
		CreatedAt:       record.CreatedAt,
		UpdatedAt:       record.UpdatedAt,
	}
}

func clientRecordFromInput(creds storage.Credentials) storage.ClientRecord {
	now := time.Now().UTC()
	return storage.ClientRecord{
		ID:              "",
		Name:            "",
		Tag:             "",
		Provider:        creds.Provider,
		Endpoint:        creds.Endpoint,
		Region:          creds.Region,
		UseSSL:          creds.UseSSL,
		Port:            creds.Port,
		AccessKeyID:     creds.AccessKeyID,
		SecretAccessKey: creds.SecretAccessKey,
		SessionToken:    "",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

func (s *Service) credentialsFromRecord(ctx context.Context, record accountRecord) (storage.Credentials, error) {
	return storage.Credentials{
		Provider:        record.Provider,
		Endpoint:        record.Endpoint,
		AccessKeyID:     record.AccessKeyID,
		SecretAccessKey: record.EncryptedSecret,
		Region:          record.Region,
		Extra:           toMap(record.Extra),
		UseSSL:          record.UseSSL,
		Port:            record.Port,
	}, nil
}

func toAccount(record accountRecord) Account {
	return Account{
		ID:               record.ID,
		Name:             record.Name,
		Tag:              record.Tag,
		Provider:         record.Provider,
		ProviderLabel:    record.Provider.Label(),
		Endpoint:         record.Endpoint,
		Region:           record.Region,
		Extra:            toMap(record.Extra),
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

// toJSON converts map[string]string to Extra (map[string]any).
func toJSON(input map[string]string) Extra {
	if len(input) == 0 {
		return make(Extra)
	}
	result := make(Extra, len(input))
	for k, v := range input {
		result[k] = v
	}
	return result
}

// toMap converts Extra (map[string]any) to map[string]string.
func toMap(input Extra) map[string]string {
	if len(input) == 0 {
		return make(map[string]string)
	}
	result := make(map[string]string, len(input))
	for k, v := range input {
		if s, ok := v.(string); ok {
			result[k] = s
		}
	}
	return result
}
