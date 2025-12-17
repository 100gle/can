package objects

import (
	"strings"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	url := "https://example.com/bucket/object?signature=abc123"
	password := "MySecurePassword123"

	metadata := &ShareLinkMetadata{
		FileName:  "report.pdf",
		Method:    "GET",
		ExpiresAt: "2025-12-07T12:00:00Z",
	}

	encrypted, err := EncryptShareLink(url, password, metadata)
	if err != nil {
		t.Fatalf("encrypt share link: %v", err)
	}

	if encrypted == "" {
		t.Fatal("encrypted package is empty")
	}

	decrypted, decryptedMeta, err := DecryptShareLink(encrypted, password)
	if err != nil {
		t.Fatalf("decrypt share link: %v", err)
	}

	if decrypted != url {
		t.Fatalf("expected URL %s, got %s", url, decrypted)
	}

	if decryptedMeta == nil {
		t.Fatal("expected metadata to be preserved")
	}

	if decryptedMeta.FileName != metadata.FileName {
		t.Fatalf("expected filename %s, got %s", metadata.FileName, decryptedMeta.FileName)
	}
}

func TestDecryptWithWrongPassword(t *testing.T) {
	url := "https://example.com/secret"
	correctPassword := "correct"
	wrongPassword := "wrong"

	encrypted, err := EncryptShareLink(url, correctPassword, nil)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	_, _, err = DecryptShareLink(encrypted, wrongPassword)
	if err == nil {
		t.Fatal("expected error when decrypting with wrong password")
	}

	if !strings.Contains(err.Error(), "wrong password") && !strings.Contains(err.Error(), "decrypt") {
		t.Fatalf("expected decryption error, got: %v", err)
	}
}

func TestEncryptedPackageFormat(t *testing.T) {
	url := "https://storage.example.com/file.bin"
	password := "password"

	encrypted, err := EncryptShareLink(url, password, nil)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	// Should be base64 encoded
	if encrypted == url {
		t.Fatal("encrypted package should not be the same as plaintext URL")
	}

	// Should be deterministically different each time (due to random salt/nonce)
	encrypted2, err := EncryptShareLink(url, password, nil)
	if err != nil {
		t.Fatalf("encrypt second time: %v", err)
	}

	if encrypted == encrypted2 {
		t.Fatal("two encryptions should produce different ciphertexts (random salt/nonce)")
	}

	// But both should decrypt to the same URL
	decrypted1, _, _ := DecryptShareLink(encrypted, password)
	decrypted2, _, _ := DecryptShareLink(encrypted2, password)

	if decrypted1 != url || decrypted2 != url {
		t.Fatal("both encrypted packages should decrypt to original URL")
	}
}

func TestEncryptShareLinkValidation(t *testing.T) {
	tests := []struct {
		url      string
		password string
		wantErr  bool
	}{
		{"", "password", true},
		{"https://example.com", "", true},
		{"https://example.com", "pass", false},
	}

	for _, tt := range tests {
		_, err := EncryptShareLink(tt.url, tt.password, nil)
		if (err != nil) != tt.wantErr {
			t.Errorf("EncryptShareLink(%q, %q) error = %v, wantErr %v", tt.url, tt.password, err, tt.wantErr)
		}
	}
}

func TestDecryptShareLinkValidation(t *testing.T) {
	validEncrypted, _ := EncryptShareLink("https://example.com", "password", nil)

	tests := []struct {
		pkg      string
		password string
		wantErr  bool
	}{
		{"", "password", true},
		{validEncrypted, "", true},
		{"invalid-base64!", "password", true},
		{validEncrypted, "password", false},
	}

	for _, tt := range tests {
		_, _, err := DecryptShareLink(tt.pkg, tt.password)
		if (err != nil) != tt.wantErr {
			t.Errorf("DecryptShareLink error = %v, wantErr %v", err, tt.wantErr)
		}
	}
}

func TestEncryptWithoutMetadata(t *testing.T) {
	url := "https://example.com/file"
	password := "test123"

	encrypted, err := EncryptShareLink(url, password, nil)
	if err != nil {
		t.Fatalf("encrypt without metadata: %v", err)
	}

	decrypted, metadata, err := DecryptShareLink(encrypted, password)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}

	if decrypted != url {
		t.Fatalf("expected %s, got %s", url, decrypted)
	}

	// Metadata is optional, should be nil if not provided
	if metadata != nil && (metadata.FileName != "" || metadata.Method != "" || metadata.ExpiresAt != "") {
		t.Fatalf("expected nil or empty metadata, got %+v", metadata)
	}
}

func TestMetadataSurvivesEncryption(t *testing.T) {
	url := "https://cdn.example.com/video.mp4"
	password := "secret"

	meta := &ShareLinkMetadata{
		FileName:  "video.mp4",
		Method:    "GET",
		ExpiresAt: "2025-12-31T23:59:59Z",
	}

	encrypted, err := EncryptShareLink(url, password, meta)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	_, decryptedMeta, err := DecryptShareLink(encrypted, password)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}

	if decryptedMeta == nil {
		t.Fatal("metadata was lost during encryption/decryption")
	}

	if decryptedMeta.FileName != meta.FileName {
		t.Errorf("FileName: got %s, want %s", decryptedMeta.FileName, meta.FileName)
	}
	if decryptedMeta.Method != meta.Method {
		t.Errorf("Method: got %s, want %s", decryptedMeta.Method, meta.Method)
	}
	if decryptedMeta.ExpiresAt != meta.ExpiresAt {
		t.Errorf("ExpiresAt: got %s, want %s", decryptedMeta.ExpiresAt, meta.ExpiresAt)
	}
}
