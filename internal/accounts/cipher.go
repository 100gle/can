package accounts

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Cipher provides basic symmetric encryption helpers for sensitive fields.
type Cipher interface {
	EncryptString(ctx context.Context, plaintext string) (string, error)
	DecryptString(ctx context.Context, ciphertext string) (string, error)
}

// NoopCipher is used when no master key is provided; it preserves plaintext for easy rollback.
type NoopCipher struct{}

// EncryptString returns plaintext unchanged for NoopCipher.
func (NoopCipher) EncryptString(_ context.Context, plaintext string) (string, error) {
	return plaintext, nil
}

// DecryptString returns ciphertext unchanged for NoopCipher.
func (NoopCipher) DecryptString(_ context.Context, ciphertext string) (string, error) {
	return ciphertext, nil
}

// AESCipher encrypts data using AES-256-GCM.
type AESCipher struct {
	gcm cipher.AEAD
}

// EncryptString encrypts input and returns base64 encoded ciphertext with nonce prefix.
func (c *AESCipher) EncryptString(_ context.Context, plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	sealed := c.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// DecryptString decrypts ciphertext produced by EncryptString.
func (c *AESCipher) DecryptString(_ context.Context, ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	blob, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decode secret: %w", err)
	}
	if len(blob) < c.gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce := blob[:c.gcm.NonceSize()]
	payload := blob[c.gcm.NonceSize():]
	plain, err := c.gcm.Open(nil, nonce, payload, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt secret: %w", err)
	}
	return string(plain), nil
}

// NewAESCipher builds an AES-256-GCM cipher with the provided 32-byte key.
func NewAESCipher(key []byte) (Cipher, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("expected 32 byte key, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}
	return &AESCipher{gcm: gcm}, nil
}

// DefaultCipher attempts to instantiate an AES cipher based on CAN_MASTER_KEY env, falling back to NoopCipher.
func DefaultCipher() Cipher {
	key := strings.TrimSpace(os.Getenv("CAN_MASTER_KEY"))
	if key == "" {
		return NoopCipher{}
	}
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		return NoopCipher{}
	}
	cipher, err := NewAESCipher(decoded)
	if err != nil {
		return NoopCipher{}
	}
	return cipher
}
