package backup

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"can/internal/accounts"
	"can/internal/objects"

	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

type ServiceImpl struct {
	accounts      *accounts.Service
	objects       *objects.Service
	dataDir       string // To locate settings.json etc.
	snapshotStore *SnapshotStore
}

func NewService(accounts *accounts.Service, objects *objects.Service, dataDir string) *ServiceImpl {
	return &ServiceImpl{
		accounts:      accounts,
		objects:       objects,
		dataDir:       dataDir,
		snapshotStore: NewSnapshotStore(dataDir),
	}
}

// BackupContainer represents the structure of the backup file on disk.
// It supports both legacy (plaintext) and secure (encrypted) formats.
type BackupContainer struct {
	Header  *BackupHeader     `json:"header"`
	Content *AppBackupContent `json:"content,omitempty"` // cleartext content (legacy/unencrypted)
	Data    []byte            `json:"data,omitempty"`    // encrypted content
	Salt    []byte            `json:"salt,omitempty"`    // salt for KDF
	Nonce   []byte            `json:"nonce,omitempty"`   // nonce for AES-GCM
}

const (
	keyLen  = 32
	saltLen = 16
)

func (s *ServiceImpl) CreateAppBackup(ctx context.Context, encrypted bool, password string) (*BackupHeader, []byte, error) {
	// 1. Export Accounts
	accData, err := s.accounts.ExportData(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to export accounts: %w", err)
	}

	// 2. Prepare Backup Content
	content := AppBackupContent{
		Accounts: accData.Blob,
	}

	// 3. Create Header
	header := &BackupHeader{
		ID:        uuid.New().String(),
		Type:      BackupTypeAppConfig,
		CreatedAt: time.Now(),
		Version:   "1.0.0",
		Encrypted: encrypted,
	}

	container := BackupContainer{
		Header: header,
	}

	// 4. Encrypt or Embed
	if encrypted {
		if password == "" {
			return nil, nil, errors.New("password is required for encrypted backup")
		}

		// Marshal content to bytes first
		plaintext, err := json.Marshal(content)
		if err != nil {
			return nil, nil, fmt.Errorf("marshal content: %w", err)
		}

		// Encrypt
		salt, nonce, ciphertext, err := encrypt(plaintext, password)
		if err != nil {
			return nil, nil, fmt.Errorf("encrypt: %w", err)
		}

		container.Data = ciphertext
		container.Salt = salt
		container.Nonce = nonce
	} else {
		container.Content = &content
	}

	// 5. Serialize Final Container
	finalBytes, err := json.Marshal(container)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal container: %w", err)
	}

	return header, finalBytes, nil
}

func (s *ServiceImpl) RestoreAppBackup(ctx context.Context, data []byte, password string) error {
	var container BackupContainer
	if err := json.Unmarshal(data, &container); err != nil {
		return fmt.Errorf("unmarshal backup: %w", err)
	}

	if container.Header == nil {
		return errors.New("invalid backup: missing header")
	}

	var content *AppBackupContent

	if container.Header.Encrypted {
		if len(container.Data) == 0 {
			return errors.New("invalid backup: encrypted but no data found")
		}
		if password == "" {
			return errors.New("backup is encrypted, password required")
		}

		plaintext, err := decrypt(container.Data, container.Salt, container.Nonce, password)
		if err != nil {
			return fmt.Errorf("decrypt failed (wrong password?): %w", err)
		}

		content = &AppBackupContent{}
		if err := json.Unmarshal(plaintext, content); err != nil {
			return fmt.Errorf("unmarshal decrypted content: %w", err)
		}
	} else {
		// Plaintext mode
		if container.Content == nil {
			// Fallback: check if 'Data' exists (maybe user messed up manual editing?)
			// OR support old format where root object WAS the FullBackup struct.
			// The old code had: type FullBackup struct { Header, Content }
			// The new BackupContainer is compatible with that JSON structure!
			// If Content is nil, maybe it really is empty or invalid.
			return errors.New("invalid backup: no content found")
		}
		content = container.Content
	}

	// Restore Accounts
	if len(content.Accounts) > 0 {
		_, err := s.accounts.ImportData(ctx, content.Accounts)
		if err != nil {
			return fmt.Errorf("import accounts: %w", err)
		}
	}

	return nil
}

func (s *ServiceImpl) CreateBucketSnapshot(ctx context.Context, accountID, bucket string) (*BackupHeader, error) {
	// List objects recursively
	input := objects.ListObjectsInput{
		Bucket: bucket,
		Limit:  1000,
	}

	var allObjects []SnapshotObject
	var marker string

	for {
		input.Marker = marker
		res, err := s.objects.ListObjects(ctx, accountID, input)
		if err != nil {
			return nil, err
		}

		for _, obj := range res.Objects {
			if !obj.IsDir {
				allObjects = append(allObjects, SnapshotObject{
					Key:          obj.Key,
					Size:         obj.Size,
					LastModified: obj.LastModified,
					ETag:         obj.ETag,
				})
			}
		}

		if !res.Truncated {
			break
		}
		marker = res.NextMarker
	}

	// Create Header
	header := &BackupHeader{
		ID:          uuid.New().String(),
		Type:        BackupTypeSnapshot,
		CreatedAt:   time.Now(),
		AccountID:   accountID,
		BucketName:  bucket,
		ObjectCount: int64(len(allObjects)),
	}

	// Persist to store
	if err := s.snapshotStore.SaveSnapshot(header, allObjects); err != nil {
		return nil, fmt.Errorf("failed to save snapshot: %w", err)
	}

	return header, nil
}

func (s *ServiceImpl) ListSnapshots(ctx context.Context, accountID, bucket string) ([]*BackupHeader, error) {
	return s.snapshotStore.ListSnapshots(accountID, bucket)
}

func (s *ServiceImpl) RestoreSnapshot(ctx context.Context, snapshotID string) error {
	// Get snapshot metadata
	header, err := s.snapshotStore.GetSnapshot(snapshotID)
	if err != nil {
		return fmt.Errorf("snapshot not found: %w", err)
	}

	// Get snapshot content (object list)
	content, err := s.snapshotStore.GetSnapshotContent(snapshotID)
	if err != nil {
		return fmt.Errorf("failed to read snapshot content: %w", err)
	}

	// Validate bucket exists or at least log what we are doing
	fmt.Printf("Starting restore analysis for snapshot %s (Bucket: %s)\n", snapshotID, header.BucketName)

	// In a real implementation, we would now list the live bucket and compare.
	// For now, we return a designated error to indicate we are not performing changes yet,
	// or we just log the diff planning.
	// Code review suggestion: "return not implemented error or minimal diff logic"

	// Let's implement a minimal dry-run diff log
	// We need to list the CURRENT objects to know what is missing.
	// NOTE: This could be slow for large buckets.
	// For validation purposes, we will just proceed with a "Dry Run" success message
	// but strictly log it so user knows nothing happened.

	// Refactoring request: "Return 'not implemented' error or落地 diff"
	// Let's return a wrapping error that the frontend can handle, or just success + logs.
	// Given the context of "logic missing", returning success is misleading.
	// Let's return a "DryRunOnly" error or similar if we strictly follow advice,
	// but standard Go doesn't have that.
	// I will return nil but change the print to be very explicit, OR actually implement a check.

	// Let's TRY to do a quick check of the first few objects to see if they exist?
	// No, that's partial.
	// I'll stick to the "Not Implemented" error to be safe as per expert advice.
	return fmt.Errorf("restore logic not fully implemented: snapshot %s is valid containing %d objects, but auto-restore is disabled", snapshotID, len(content.Objects))
}

// DeleteSnapshot removes a snapshot by ID.
func (s *ServiceImpl) DeleteSnapshot(ctx context.Context, snapshotID string) error {
	return s.snapshotStore.DeleteSnapshot(snapshotID)
}

// Helpers

func encrypt(plaintext []byte, password string) (salt, nonce, ciphertext []byte, err error) {
	salt = make([]byte, saltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, nil, nil, err
	}

	key := deriveKey(password, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, nil, err
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return salt, nonce, ciphertext, nil
}

func decrypt(ciphertext, salt, nonce []byte, password string) ([]byte, error) {
	key := deriveKey(password, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func deriveKey(password string, salt []byte) []byte {
	// Argon2id
	// Memory: 64MB, Iterations: 1, Parallelism: 4, TagLen: 32
	return argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, keyLen)
}
