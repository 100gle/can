package accounts

import (
	"context"
	"testing"
)

func TestAESCipherRoundTrip(t *testing.T) {
	ctx := context.Background()
	key := []byte("01234567890123456789012345678901") // 32 bytes
	cipher, err := NewAESCipher(key)
	if err != nil {
		t.Fatalf("NewAESCipher: %v", err)
	}

	plaintext := "super secret password"
	encrypted, err := cipher.EncryptString(ctx, plaintext)
	if err != nil {
		t.Fatalf("EncryptString: %v", err)
	}
	if encrypted == plaintext {
		t.Error("encrypted text should not equal plaintext")
	}
	if encrypted == "" {
		t.Error("encrypted text should not be empty")
	}

	decrypted, err := cipher.DecryptString(ctx, encrypted)
	if err != nil {
		t.Fatalf("DecryptString: %v", err)
	}
	if decrypted != plaintext {
		t.Errorf("expected %q, got %q", plaintext, decrypted)
	}
}

func TestAESCipherHandlesEmptyString(t *testing.T) {
	ctx := context.Background()
	key := []byte("01234567890123456789012345678901")
	cipher, err := NewAESCipher(key)
	if err != nil {
		t.Fatalf("NewAESCipher: %v", err)
	}

	encrypted, err := cipher.EncryptString(ctx, "")
	if err != nil {
		t.Fatalf("EncryptString empty: %v", err)
	}
	if encrypted != "" {
		t.Errorf("expected empty encrypted for empty input, got %q", encrypted)
	}

	decrypted, err := cipher.DecryptString(ctx, "")
	if err != nil {
		t.Fatalf("DecryptString empty: %v", err)
	}
	if decrypted != "" {
		t.Errorf("expected empty decrypted for empty input, got %q", decrypted)
	}
}

func TestNoopCipherPassthrough(t *testing.T) {
	ctx := context.Background()
	cipher := NoopCipher{}

	plaintext := "whatever"
	encrypted, err := cipher.EncryptString(ctx, plaintext)
	if err != nil {
		t.Fatalf("EncryptString: %v", err)
	}
	if encrypted != plaintext {
		t.Errorf("NoopCipher should return plaintext, got %q", encrypted)
	}

	decrypted, err := cipher.DecryptString(ctx, encrypted)
	if err != nil {
		t.Fatalf("DecryptString: %v", err)
	}
	if decrypted != plaintext {
		t.Errorf("NoopCipher should return ciphertext, got %q", decrypted)
	}
}

func TestNewAESCipherRejectsInvalidKeyLength(t *testing.T) {
	testCases := []struct {
		name    string
		keyLen  int
		wantErr bool
	}{
		{"too short 16", 16, true},
		{"too short 24", 24, true},
		{"valid 32", 32, false},
		{"too long 64", 64, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			key := make([]byte, tc.keyLen)
			for i := range key {
				key[i] = byte('a' + i%26)
			}
			_, err := NewAESCipher(key)
			if tc.wantErr && err == nil {
				t.Errorf("expected error for key length %d", tc.keyLen)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("unexpected error for key length %d: %v", tc.keyLen, err)
			}
		})
	}
}

func TestAESCipherDecryptInvalidCiphertext(t *testing.T) {
	ctx := context.Background()
	key := []byte("01234567890123456789012345678901")
	cipher, err := NewAESCipher(key)
	if err != nil {
		t.Fatalf("NewAESCipher: %v", err)
	}

	// Invalid base64
	_, err = cipher.DecryptString(ctx, "not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}

	// Too short ciphertext (valid base64 but too short for nonce)
	_, err = cipher.DecryptString(ctx, "YWJj") // "abc" in base64
	if err == nil {
		t.Error("expected error for too short ciphertext")
	}
}

func TestAESCipherProducesDifferentCiphertexts(t *testing.T) {
	ctx := context.Background()
	key := []byte("01234567890123456789012345678901")
	cipher, err := NewAESCipher(key)
	if err != nil {
		t.Fatalf("NewAESCipher: %v", err)
	}

	plaintext := "same input"
	enc1, _ := cipher.EncryptString(ctx, plaintext)
	enc2, _ := cipher.EncryptString(ctx, plaintext)

	// Due to random nonce, same plaintext should produce different ciphertexts
	if enc1 == enc2 {
		t.Error("expected different ciphertexts for same plaintext (random nonce)")
	}

	// Both should decrypt to the same plaintext
	dec1, _ := cipher.DecryptString(ctx, enc1)
	dec2, _ := cipher.DecryptString(ctx, enc2)
	if dec1 != plaintext || dec2 != plaintext {
		t.Errorf("decrypted values mismatch: %q, %q", dec1, dec2)
	}
}
