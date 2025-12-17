package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"can/internal/accounts"
	"can/internal/db"
	"can/internal/transfer"

	"gorm.io/gorm"
)

const defaultRequestTimeout = 60 * time.Second

func ResolveRequestTimeout() time.Duration {
	return defaultRequestTimeout
}

func InitSharedStore() *gorm.DB {
	return db.Get()
}

func InitAccountsStore() accounts.Store {
	db := InitSharedStore()
	store, err := accounts.NewSQLiteStore(db)
	if err != nil {
		panic(fmt.Sprintf("failed to init accounts store: %v", err))
	}
	return store
}

func InitTransferStore() transfer.Store {
	db := InitSharedStore()
	store, err := transfer.NewSQLiteStore(db)
	if err != nil {
		panic(fmt.Sprintf("failed to init transfer store: %v", err))
	}
	return store
}

func DefaultSQLitePath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "can.db"), nil
}

func DefaultDataDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = filepath.Join(os.TempDir(), "can")
	} else {
		dir = filepath.Join(dir, "can")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}
