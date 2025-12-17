package objects

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	saltSize         = 32
	keySize          = 32 // AES-256
	pbkdf2Iterations = 100000
	nonceSize        = 12 // GCM standard nonce size
)

// EncryptedSharePackage contains an encrypted share link and its salt.
type EncryptedSharePackage struct {
	Version    int    `json:"version"`
	Salt       string `json:"salt"`               // Base64-encoded salt for key derivation
	Nonce      string `json:"nonce"`              // Base64-encoded nonce for GCM
	Ciphertext string `json:"ciphertext"`         // Base64-encoded encrypted URL
	Metadata   string `json:"metadata,omitempty"` // Optional metadata (file name, expiry, etc.)
}

// ShareLinkMetadata contains additional information about the share link.
type ShareLinkMetadata struct {
	FileName  string `json:"fileName,omitempty"`
	Method    string `json:"method,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
}

// EncryptShareLink encrypts a presigned URL with a password using AES-256-GCM.
func EncryptShareLink(url, password string, metadata *ShareLinkMetadata) (string, error) {
	if url == "" {
		return "", errors.New("url is required")
	}
	if password == "" {
		return "", errors.New("password is required")
	}

	// Generate random salt
	salt := make([]byte, saltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	// Derive key from password using PBKDF2
	key := pbkdf2.Key([]byte(password), salt, pbkdf2Iterations, keySize, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}

	// Generate nonce
	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	// Encrypt the URL
	ciphertext := gcm.Seal(nil, nonce, []byte(url), nil)

	// Build package
	pkg := EncryptedSharePackage{
		Version:    1,
		Salt:       base64.StdEncoding.EncodeToString(salt),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}

	// Add optional metadata
	if metadata != nil {
		metadataJSON, err := json.Marshal(metadata)
		if err == nil {
			pkg.Metadata = base64.StdEncoding.EncodeToString(metadataJSON)
		}
	}

	// Encode package as JSON and then base64
	packageJSON, err := json.Marshal(pkg)
	if err != nil {
		return "", fmt.Errorf("marshal package: %w", err)
	}

	encoded := base64.StdEncoding.EncodeToString(packageJSON)
	return encoded, nil
}

// DecryptShareLink decrypts an encrypted share package with the password.
func DecryptShareLink(encodedPackage, password string) (string, *ShareLinkMetadata, error) {
	if encodedPackage == "" {
		return "", nil, errors.New("package is required")
	}
	if password == "" {
		return "", nil, errors.New("password is required")
	}

	// Decode base64 package
	packageJSON, err := base64.StdEncoding.DecodeString(encodedPackage)
	if err != nil {
		return "", nil, fmt.Errorf("decode package: %w", err)
	}

	// Unmarshal package
	var pkg EncryptedSharePackage
	if err := json.Unmarshal(packageJSON, &pkg); err != nil {
		return "", nil, fmt.Errorf("unmarshal package: %w", err)
	}

	// Check version
	if pkg.Version != 1 {
		return "", nil, fmt.Errorf("unsupported package version: %d", pkg.Version)
	}

	// Decode components
	salt, err := base64.StdEncoding.DecodeString(pkg.Salt)
	if err != nil {
		return "", nil, fmt.Errorf("decode salt: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(pkg.Nonce)
	if err != nil {
		return "", nil, fmt.Errorf("decode nonce: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(pkg.Ciphertext)
	if err != nil {
		return "", nil, fmt.Errorf("decode ciphertext: %w", err)
	}

	// Derive key from password
	key := pbkdf2.Key([]byte(password), salt, pbkdf2Iterations, keySize, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", nil, fmt.Errorf("create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", nil, fmt.Errorf("create gcm: %w", err)
	}

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", nil, fmt.Errorf("decrypt: wrong password or corrupted data")
	}

	// Decode metadata if present
	var metadata *ShareLinkMetadata
	if pkg.Metadata != "" {
		metadataJSON, err := base64.StdEncoding.DecodeString(pkg.Metadata)
		if err == nil {
			var m ShareLinkMetadata
			if err := json.Unmarshal(metadataJSON, &m); err == nil {
				metadata = &m
			}
		}
	}

	return string(plaintext), metadata, nil
}
