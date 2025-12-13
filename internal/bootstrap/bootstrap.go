package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/search"
	"can/internal/transfer"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const defaultRequestTimeout = 60 * time.Second

func ResolveRequestTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("CAN_REQUEST_TIMEOUT"))
	if raw == "" {
		return defaultRequestTimeout
	}
	if duration, err := time.ParseDuration(raw); err == nil && duration > 0 {
		return duration
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	fmt.Printf("invalid CAN_REQUEST_TIMEOUT %q, fallback to %s\n", raw, defaultRequestTimeout)
	return defaultRequestTimeout
}

// Shared global DB instance to prevent multiple connections
var sharedDB *gorm.DB

func InitSharedStore() *gorm.DB {
	if sharedDB != nil {
		return sharedDB
	}

	path := strings.TrimSpace(os.Getenv("CAN_DB_DSN"))
	if path == "" {
		dir, err := DefaultDataDir()
		if err != nil {
			panic(fmt.Sprintf("failed to resolve default data dir: %v", err))
		}
		path = filepath.Join(dir, "can.db")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		panic(fmt.Sprintf("prepare db directory: %v", err))
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		panic(fmt.Sprintf("failed to open shared database (%s): %v", path, err))
	}
	sharedDB = db
	return db
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

func InitSearchStore() search.SavedQueryStore {
	db := InitSharedStore()
	store, err := search.NewSQLiteStore(db)
	if err != nil {
		panic(fmt.Sprintf("failed to init search store: %v", err))
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

func InitSessionStore() accounts.ActiveSessionStore {
	path := strings.TrimSpace(os.Getenv("CAN_SESSION_PATH"))
	if path == "" {
		dir, err := os.UserConfigDir()
		if err != nil || dir == "" {
			dir = filepath.Join(os.TempDir(), "can")
		} else {
			dir = filepath.Join(dir, "can")
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			fmt.Printf("failed to prepare session directory, using memory store: %v\n", err)
			return accounts.NewMemorySessionStore()
		}
		path = filepath.Join(dir, "session.json")
	}
	store, err := accounts.NewFileSessionStore(path)
	if err != nil {
		fmt.Printf("failed to create session store (%s), using memory store: %v\n", path, err)
		return accounts.NewMemorySessionStore()
	}
	return store
}
