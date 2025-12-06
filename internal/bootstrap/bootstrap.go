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

func InitAccountsStore() accounts.Store {
	driver := strings.TrimSpace(os.Getenv("CAN_DB_DRIVER"))
	if driver == "" {
		driver = "sqlite"
	}
	switch strings.ToLower(driver) {
	case "memory":
		return accounts.NewMemoryStore()
	case "sqlite":
		dsn := strings.TrimSpace(os.Getenv("CAN_DB_DSN"))
		if dsn == "" {
			path, err := DefaultSQLitePath()
			if err != nil {
				fmt.Printf("failed to resolve default sqlite path, fallback to memory: %v\n", err)
				break
			}
			dsn = path
		}
		store, err := accounts.NewSQLiteStore(dsn)
		if err != nil {
			fmt.Printf("failed to init sqlite store (%s): %v\n", dsn, err)
			break
		}
		return store
	default:
		fmt.Printf("unknown CAN_DB_DRIVER %q, fallback to sqlite\n", driver)
		os.Setenv("CAN_DB_DRIVER", "sqlite")
		return InitAccountsStore()
	}
	return accounts.NewMemoryStore()
}

func InitTransferStore() transfer.Store {
	path := strings.TrimSpace(os.Getenv("CAN_TRANSFER_DB"))
	if path == "" {
		var err error
		path, err = DefaultTransferPath()
		if err != nil {
			fmt.Printf("failed to resolve default transfer db path, using memory store: %v\n", err)
			return transfer.NewMemoryStore()
		}
	}
	store, err := transfer.NewSQLiteStore(path)
	if err != nil {
		fmt.Printf("failed to init transfer sqlite store (%s): %v\n", path, err)
		return transfer.NewMemoryStore()
	}
	return store
}

func InitSearchStore() search.SavedQueryStore {
	path := strings.TrimSpace(os.Getenv("CAN_SEARCH_DB"))
	if path == "" {
		var err error
		path, err = defaultSearchPath()
		if err != nil {
			fmt.Printf("failed to resolve default search db path, using memory store: %v\n", err)
			return search.NewMemorySavedQueryStore()
		}
	}
	store, err := search.NewSQLiteStore(path)
	if err != nil {
		fmt.Printf("failed to init search sqlite store (%s): %v\n", path, err)
		return search.NewMemorySavedQueryStore()
	}
	return store
}

func DefaultSQLitePath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "accounts.db"), nil
}

func DefaultTransferPath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "transfers.db"), nil
}

func defaultSearchPath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "search.db"), nil
}

func DefaultAnalyticsPath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "analytics.db"), nil
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
