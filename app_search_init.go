package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"can/internal/search"
)

func initSearchStore() search.SavedQueryStore {
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

func defaultSearchPath() (string, error) {
	dir, err := defaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "search.db"), nil
}
