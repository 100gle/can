package accounts

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

// Service orchestrates account CRUD, encryption, and provider probing.
type Service struct {
	store    Store
	cipher   security.Cipher
	dialer   providers.Dialer
	session  ActiveSessionStore
	clients  providers.ClientPool
	activeID string

	activeLoaded bool
	mu           sync.RWMutex
}

// NewService wires dependencies for account management.
func NewService(store Store, cipher security.Cipher, dialer providers.Dialer, session ActiveSessionStore) *Service {
	if session == nil {
		session = NewMemorySessionStore()
	}
	return &Service{store: store, cipher: cipher, dialer: dialer, session: session}
}

// SetClientPool wires the provider client cache for cross-service invalidation events.
func (s *Service) SetClientPool(pool providers.ClientPool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clients = pool
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
		Tag:             strings.TrimSpace(input.Tag),
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
	if input.Provider != nil {
		provider := types.ParseProvider(string(*input.Provider))
		record.Provider = provider
	}
	if input.Name != nil {
		record.Name = strings.TrimSpace(*input.Name)
	}
	if input.Tag != nil {
		record.Tag = strings.TrimSpace(*input.Tag)
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
	s.invalidateClientPool(id)
	return toAccount(record), nil
}

// DeleteAccount removes the given account.
func (s *Service) DeleteAccount(ctx context.Context, id string) error {
	s.ensureActiveLoaded(ctx)
	s.mu.Lock()
	if s.activeID == id {
		s.activeID = ""
		if s.session != nil {
			_ = s.session.Clear(ctx)
		}
	}
	s.mu.Unlock()
	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidateClientPool(id)
	return nil
}

// SetActiveAccount marks the provided account as active.
func (s *Service) SetActiveAccount(ctx context.Context, id string) (Account, error) {
	s.ensureActiveLoaded(ctx)
	record, err := s.store.Get(ctx, id)
	if err != nil {
		return Account{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.session != nil {
		if err := s.session.Save(ctx, id); err != nil {
			return Account{}, err
		}
	}
	s.activeID = id
	s.activeLoaded = true
	return toAccount(record), nil
}

// ActiveAccount returns actives account if any.
func (s *Service) ActiveAccount(ctx context.Context) (*Account, error) {
	s.ensureActiveLoaded(ctx)
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
			if s.session != nil {
				_ = s.session.Clear(ctx)
			}
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

// TestConnectionWithInput verifies credentials that have not been persisted yet.
func (s *Service) TestConnectionWithInput(ctx context.Context, input CreateAccountInput) (ConnectionTestResult, error) {
	cloned := input
	if strings.TrimSpace(cloned.Name) == "" {
		cloned.Name = "connection-test"
	}
	if err := validateCreateInput(cloned); err != nil {
		return ConnectionTestResult{}, err
	}
	creds := credentialsFromInput(cloned)
	status := "ok"
	message := "connection verified"
	if err := s.dialer.TestConnection(ctx, creds); err != nil {
		status = "error"
		message = err.Error()
	}
	return ConnectionTestResult{
		AccountID: "",
		Provider:  creds.Provider,
		Status:    status,
		Message:   message,
		CheckedAt: time.Now().UTC(),
	}, nil
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

func credentialsFromInput(input CreateAccountInput) providers.ConnectionCredentials {
	provider := input.Provider
	if provider == "" {
		provider = types.ProviderCustom
	}
	return providers.ConnectionCredentials{
		Provider:        provider,
		Endpoint:        strings.TrimSpace(input.Endpoint),
		AccessKeyID:     strings.TrimSpace(input.AccessKeyID),
		SecretAccessKey: strings.TrimSpace(input.SecretAccessKey),
		Region:          strings.TrimSpace(input.Region),
		UseSSL:          input.UseSSL,
		Port:            input.Port,
	}
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
		Tag:              record.Tag,
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

func (s *Service) invalidateClientPool(accountID string) {
	id := strings.TrimSpace(accountID)
	if id == "" {
		return
	}
	s.mu.RLock()
	pool := s.clients
	s.mu.RUnlock()
	if pool != nil {
		pool.Invalidate(id)
	}
}

func (s *Service) ensureActiveLoaded(ctx context.Context) {
	s.mu.RLock()
	if s.activeLoaded {
		s.mu.RUnlock()
		return
	}
	s.mu.RUnlock()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.activeLoaded {
		return
	}
	if s.session != nil {
		if id, err := s.session.Load(ctx); err == nil {
			id = strings.TrimSpace(id)
			if id != "" {
				if _, err := s.store.Get(ctx, id); err == nil {
					s.activeID = id
				} else {
					_ = s.session.Clear(ctx)
				}
			}
		}
	}
	s.activeLoaded = true
}
