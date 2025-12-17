package storage

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"can/internal/db"
)

// ClientVault manages storage clients and their configuration.
type ClientVault struct {
	db      *gorm.DB
	builder ClientBuilder
}

// NewClientVault creates a new vault for managing storage clients.
func NewClientVault(database *gorm.DB, builder ClientBuilder) *ClientVault {
	if database == nil {
		database = db.Get()
	}
	if err := database.AutoMigrate(&ClientRecord{}); err != nil {
		panic(fmt.Sprintf("auto migrate clients: %v", err))
	}
	if builder == nil {
		builder = NewClient
	}
	return &ClientVault{db: database, builder: builder}
}

func (v *ClientVault) Get(ctx context.Context, id string) (*Client, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("id is required")
	}
	var rec ClientRecord
	if err := v.database().WithContext(ctx).First(&rec, "id = ?", id).Error; err != nil {
		return nil, err
	}
	dec := v.restore(rec)
	return v.build(ctx, dec)
}

func (v *ClientVault) List(ctx context.Context) ([]*Client, error) {
	var records []ClientRecord
	if err := v.database().WithContext(ctx).Order("name ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	clients := make([]*Client, 0, len(records))
	for _, rec := range records {
		dec := v.restore(rec)
		client, err := v.build(ctx, dec)
		if err != nil {
			return nil, fmt.Errorf("build client %s: %w", rec.ID, err)
		}
		clients = append(clients, client)
	}
	return clients, nil
}

func (v *ClientVault) Upsert(ctx context.Context, rec ClientRecord) (ClientRecord, error) {
	rec.ID = strings.TrimSpace(rec.ID)
	if rec.ID == "" {
		rec.ID = uuid.NewString()
		rec.CreatedAt = time.Now().UTC()
	}
	rec.UpdatedAt = time.Now().UTC()
	enc := v.prepare(rec)
	if err := v.database().WithContext(ctx).Save(&enc).Error; err != nil {
		return ClientRecord{}, err
	}
	return rec, nil
}

func (v *ClientVault) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return errors.New("id is required")
	}
	return v.database().WithContext(ctx).Delete(&ClientRecord{}, "id = ?", id).Error
}

func (v *ClientVault) prepare(rec ClientRecord) ClientRecord {
	enc := rec
	enc.EncryptedAccessKeyID = rec.AccessKeyID
	enc.EncryptedSecretAccessKey = rec.SecretAccessKey
	enc.EncryptedSessionToken = rec.SessionToken
	enc.AccessKeyID = ""
	enc.SecretAccessKey = ""
	enc.SessionToken = ""
	return enc
}

func (v *ClientVault) restore(rec ClientRecord) ClientRecord {
	dec := rec
	dec.AccessKeyID = rec.EncryptedAccessKeyID
	dec.SecretAccessKey = rec.EncryptedSecretAccessKey
	dec.SessionToken = rec.EncryptedSessionToken
	return dec
}

func (v *ClientVault) build(ctx context.Context, rec ClientRecord) (*Client, error) {
	if v.builder == nil {
		return nil, errors.New("client builder not configured")
	}
	return v.builder(ctx, rec)
}

func (v *ClientVault) database() *gorm.DB {
	if v.db != nil {
		return v.db
	}
	return db.Get()
}
