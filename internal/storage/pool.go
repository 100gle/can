package storage

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

// CredentialSupplier defers credential resolution until the pool needs to build a client.
type CredentialSupplier func(context.Context) (ConnectionCredentials, error)

// ClientPool caches storage clients per account to maximise connection reuse.
type ClientPool interface {
	Get(ctx context.Context, accountID string, supplier CredentialSupplier) (StorageClient, ConnectionCredentials, error)
	Invalidate(accountID string)
}

// ClientPoolOption configures the client pool.
type ClientPoolOption func(*clientPool)

// WithClientTTL overrides how long cached clients stay valid.
func WithClientTTL(ttl time.Duration) ClientPoolOption {
	return func(pool *clientPool) {
		if ttl > 0 {
			pool.ttl = ttl
		}
	}
}

type poolEntry struct {
	client    StorageClient
	creds     ConnectionCredentials
	expiresAt time.Time
}

type clientPool struct {
	factory StorageFactory
	ttl     time.Duration
	mu      sync.RWMutex
	items   map[string]*poolEntry
}

const defaultClientTTL = 5 * time.Minute

// NewClientPool returns a production ready client cache.
func NewClientPool(factory StorageFactory, opts ...ClientPoolOption) ClientPool {
	if factory == nil {
		panic("client pool requires a storage factory")
	}
	pool := &clientPool{
		factory: factory,
		ttl:     defaultClientTTL,
		items:   make(map[string]*poolEntry),
	}
	for _, opt := range opts {
		opt(pool)
	}
	if pool.ttl <= 0 {
		pool.ttl = defaultClientTTL
	}
	return pool
}

func (p *clientPool) Get(ctx context.Context, accountID string, supplier CredentialSupplier) (StorageClient, ConnectionCredentials, error) {
	key := strings.TrimSpace(accountID)
	if key == "" {
		return nil, ConnectionCredentials{}, errors.New("account id is required")
	}
	if supplier == nil {
		return nil, ConnectionCredentials{}, errors.New("credentials supplier is required")
	}
	now := time.Now()
	p.mu.RLock()
	if entry, ok := p.items[key]; ok && now.Before(entry.expiresAt) {
		client := entry.client
		creds := entry.creds
		p.mu.RUnlock()
		return client, creds, nil
	}
	p.mu.RUnlock()
	creds, err := supplier(ctx)
	if err != nil {
		return nil, ConnectionCredentials{}, err
	}
	client, err := p.factory.NewClient(ctx, creds)
	if err != nil {
		return nil, ConnectionCredentials{}, err
	}
	entry := &poolEntry{client: client, creds: creds, expiresAt: now.Add(p.ttl)}
	p.mu.Lock()
	p.items[key] = entry
	p.mu.Unlock()
	return client, creds, nil
}

func (p *clientPool) Invalidate(accountID string) {
	key := strings.TrimSpace(accountID)
	if key == "" {
		return
	}
	p.mu.Lock()
	delete(p.items, key)
	p.mu.Unlock()
}
