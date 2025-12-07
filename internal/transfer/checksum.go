package transfer

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"strings"
)

// ChecksumAlgorithm defines supported hash algorithms for integrity verification.
type ChecksumAlgorithm string

const (
	ChecksumNone   ChecksumAlgorithm = "none"
	ChecksumMD5    ChecksumAlgorithm = "md5"
	ChecksumSHA256 ChecksumAlgorithm = "sha256"
)

// ChecksumConfig specifies how to verify downloaded file integrity.
type ChecksumConfig struct {
	Algorithm      ChecksumAlgorithm
	ExpectedValue  string
	AutoVerifyETag bool // If true, use ETag for verification when available
}

// checksumReader wraps an io.Reader and calculates a hash while reading.
type checksumReader struct {
	reader io.Reader
	hasher hash.Hash
	result string
}

// newChecksumReader creates a reader that calculates checksum on the fly.
func newChecksumReader(r io.Reader, algorithm ChecksumAlgorithm) (*checksumReader, error) {
	var hasher hash.Hash
	switch strings.ToLower(string(algorithm)) {
	case string(ChecksumMD5):
		hasher = md5.New()
	case string(ChecksumSHA256):
		hasher = sha256.New()
	case string(ChecksumNone), "":
		return &checksumReader{reader: r}, nil
	default:
		return nil, fmt.Errorf("unsupported checksum algorithm: %s", algorithm)
	}
	return &checksumReader{
		reader: r,
		hasher: hasher,
	}, nil
}

// Read implements io.Reader while computing the hash.
func (cr *checksumReader) Read(p []byte) (int, error) {
	n, err := cr.reader.Read(p)
	if n > 0 && cr.hasher != nil {
		cr.hasher.Write(p[:n])
	}
	return n, err
}

// Sum returns the computed checksum as a hex string.
func (cr *checksumReader) Sum() string {
	if cr.hasher == nil {
		return ""
	}
	if cr.result == "" {
		cr.result = hex.EncodeToString(cr.hasher.Sum(nil))
	}
	return cr.result
}

// verifyChecksum compares computed hash against expected value.
func verifyChecksum(computed, expected string, algorithm ChecksumAlgorithm) error {
	if algorithm == ChecksumNone || expected == "" {
		return nil
	}
	computed = strings.ToLower(strings.TrimSpace(computed))
	expected = strings.ToLower(strings.TrimSpace(expected))

	// Remove common prefixes and formatting
	expected = strings.TrimPrefix(expected, "md5:")
	expected = strings.TrimPrefix(expected, "sha256:")
	expected = strings.ReplaceAll(expected, "-", "")
	expected = strings.ReplaceAll(expected, " ", "")

	if computed != expected {
		return fmt.Errorf("checksum verification failed: expected %s, got %s", expected, computed)
	}
	return nil
}

// normalizeAlgorithm converts string to ChecksumAlgorithm with defaults.
func normalizeAlgorithm(alg string) ChecksumAlgorithm {
	switch strings.ToLower(strings.TrimSpace(alg)) {
	case "md5":
		return ChecksumMD5
	case "sha256", "sha-256":
		return ChecksumSHA256
	default:
		return ChecksumNone
	}
}

// extractETagChecksum attempts to extract a usable checksum from an ETag.
// S3 ETags for single-part uploads are MD5 hashes.
// Multi-part upload ETags contain a dash and are not simple MD5s.
func extractETagChecksum(etag string) (string, ChecksumAlgorithm) {
	etag = strings.Trim(etag, `"`)
	etag = strings.TrimSpace(etag)

	// Multi-part uploads have format: <hash>-<part-count>
	if strings.Contains(etag, "-") {
		return "", ChecksumNone
	}

	// Single-part ETags are typically MD5
	if len(etag) == 32 {
		return etag, ChecksumMD5
	}

	return "", ChecksumNone
}
