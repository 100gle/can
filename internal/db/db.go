package db

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	shared *gorm.DB
	once   sync.Once
)

// Get returns the shared SQLite-backed *gorm.DB instance. It opens the database
// lazily and reuses the same handle across the process so all subsystems
// operate on the same file.
func Get() *gorm.DB {
	once.Do(func() {
		shared = open()
	})
	return shared
}

func open() *gorm.DB {
	dir := defaultDataDir()
	path := filepath.Join(dir, "can.db")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		panic(fmt.Sprintf("prepare db directory: %v", err))
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		panic(fmt.Sprintf("failed to open database (%s): %v", path, err))
	}
	return db
}

func defaultDataDir() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = filepath.Join(os.TempDir(), "can")
	} else {
		dir = filepath.Join(dir, "can")
	}
	return dir
}
