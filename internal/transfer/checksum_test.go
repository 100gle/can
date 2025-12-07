package transfer

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestMD5ChecksumCalculation(t *testing.T) {
	data := []byte("hello world")
	reader := bytes.NewReader(data)

	cr, err := newChecksumReader(reader, ChecksumMD5)
	if err != nil {
		t.Fatalf("create checksum reader: %v", err)
	}

	// Read all data
	_, err = io.Copy(io.Discard, cr)
	if err != nil {
		t.Fatalf("read data: %v", err)
	}

	checksum := cr.Sum()
	expected := "5eb63bbbe01eeed093cb22bb8f5acdc3" // MD5 of "hello world"

	if checksum != expected {
		t.Fatalf("expected MD5 %s, got %s", expected, checksum)
	}
}

func TestSHA256ChecksumCalculation(t *testing.T) {
	data := []byte("test data")
	reader := bytes.NewReader(data)

	cr, err := newChecksumReader(reader, ChecksumSHA256)
	if err != nil {
		t.Fatalf("create checksum reader: %v", err)
	}

	_, err = io.Copy(io.Discard, cr)
	if err != nil {
		t.Fatalf("read data: %v", err)
	}

	checksum := cr.Sum()
	expected := "916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9"

	if checksum != expected {
		t.Fatalf("expected SHA256 %s, got %s", expected, checksum)
	}
}

func TestChecksumVerificationSuccess(t *testing.T) {
	computed := "5eb63bbbe01eeed093cb22bb8f5acdc3"
	expected := "5eb63bbbe01eeed093cb22bb8f5acdc3"

	if err := verifyChecksum(computed, expected, ChecksumMD5); err != nil {
		t.Fatalf("verification should succeed: %v", err)
	}
}

func TestChecksumVerificationFailure(t *testing.T) {
	computed := "5eb63bbbe01eeed093cb22bb8f5acdc3"
	expected := "different_checksum_value_here"

	err := verifyChecksum(computed, expected, ChecksumMD5)
	if err == nil {
		t.Fatal("expected verification to fail for mismatched checksums")
	}

	if !strings.Contains(err.Error(), "checksum verification failed") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestChecksumVerificationCaseInsensitive(t *testing.T) {
	computed := "5eb63bbbe01eeed093cb22bb8f5acdc3"
	expected := "5EB63BBBE01EEED093CB22BB8F5ACDC3"

	if err := verifyChecksum(computed, expected, ChecksumMD5); err != nil {
		t.Fatalf("verification should be case-insensitive: %v", err)
	}
}

func TestChecksumVerificationWithPrefix(t *testing.T) {
	computed := "5eb63bbbe01eeed093cb22bb8f5acdc3"
	expected := "md5:5eb63bbbe01eeed093cb22bb8f5acdc3"

	if err := verifyChecksum(computed, expected, ChecksumMD5); err != nil {
		t.Fatalf("verification should handle md5: prefix: %v", err)
	}
}

func TestChecksumNoneSkipsVerification(t *testing.T) {
	computed := "anything"
	expected := "different"

	// Should not error when algorithm is None
	if err := verifyChecksum(computed, expected, ChecksumNone); err != nil {
		t.Fatalf("ChecksumNone should skip verification: %v", err)
	}
}

func TestExtractETagChecksumSinglePart(t *testing.T) {
	etag := `"5eb63bbbe01eeed093cb22bb8f5acdc3"`

	checksum, alg := extractETagChecksum(etag)
	if alg != ChecksumMD5 {
		t.Fatalf("expected MD5 algorithm, got %s", alg)
	}
	if checksum != "5eb63bbbe01eeed093cb22bb8f5acdc3" {
		t.Fatalf("unexpected checksum: %s", checksum)
	}
}

func TestExtractETagChecksumMultiPart(t *testing.T) {
	// Multi-part upload ETag format
	etag := `"abc123def456-5"`

	checksum, alg := extractETagChecksum(etag)
	if alg != ChecksumNone {
		t.Fatalf("multi-part ETags should return ChecksumNone, got %s", alg)
	}
	if checksum != "" {
		t.Fatalf("multi-part ETags should return empty checksum, got %s", checksum)
	}
}

func TestNormalizeAlgorithm(t *testing.T) {
	tests := []struct {
		input    string
		expected ChecksumAlgorithm
	}{
		{"md5", ChecksumMD5},
		{"MD5", ChecksumMD5},
		{"sha256", ChecksumSHA256},
		{"SHA256", ChecksumSHA256},
		{"sha-256", ChecksumSHA256},
		{"", ChecksumNone},
		{"unknown", ChecksumNone},
	}

	for _, tt := range tests {
		result := normalizeAlgorithm(tt.input)
		if result != tt.expected {
			t.Errorf("normalizeAlgorithm(%q) = %s, want %s", tt.input, result, tt.expected)
		}
	}
}

func TestChecksumReaderWithNoAlgorithm(t *testing.T) {
	data := []byte("some data")
	reader := bytes.NewReader(data)

	cr, err := newChecksumReader(reader, ChecksumNone)
	if err != nil {
		t.Fatalf("create checksum reader with no algorithm: %v", err)
	}

	_, err = io.Copy(io.Discard, cr)
	if err != nil {
		t.Fatalf("read data: %v", err)
	}

	checksum := cr.Sum()
	if checksum != "" {
		t.Fatalf("expected empty checksum for ChecksumNone, got %s", checksum)
	}
}

func TestChecksumReaderUnsupportedAlgorithm(t *testing.T) {
	reader := bytes.NewReader([]byte("data"))

	_, err := newChecksumReader(reader, "unsupported")
	if err == nil {
		t.Fatal("expected error for unsupported algorithm")
	}

	if !strings.Contains(err.Error(), "unsupported checksum algorithm") {
		t.Fatalf("unexpected error message: %v", err)
	}
}
