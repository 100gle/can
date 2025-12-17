package storage

import (
	"testing"

	"can/internal/types"
)

func TestValidateBucketName(t *testing.T) {
	tests := []struct {
		name     string
		provider types.Provider
		bucket   string
		wantErr  bool
	}{
		// AWS S3 tests
		{"aws valid simple", types.ProviderAWS, "my-bucket", false},
		{"aws valid with numbers", types.ProviderAWS, "bucket123", false},
		{"aws valid with dots", types.ProviderAWS, "my.bucket.name", false},
		{"aws too short", types.ProviderAWS, "ab", true},
		{"aws too long", types.ProviderAWS, "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl", true},
		{"aws starts with hyphen", types.ProviderAWS, "-mybucket", true},
		{"aws ends with hyphen", types.ProviderAWS, "mybucket-", true},
		{"aws uppercase", types.ProviderAWS, "MyBucket", true},
		{"aws adjacent periods", types.ProviderAWS, "my..bucket", true},
		{"aws ip format", types.ProviderAWS, "192.168.1.1", true},
		{"aws prohibited prefix xn--", types.ProviderAWS, "xn--mybucket", true},
		{"aws prohibited prefix sthree-", types.ProviderAWS, "sthree-bucket", true},
		{"aws prohibited suffix -s3alias", types.ProviderAWS, "mybucket-s3alias", true},

		// OSS tests
		{"oss valid simple", types.ProviderOSS, "my-bucket", false},
		{"oss valid numbers", types.ProviderOSS, "bucket123", false},
		{"oss too short", types.ProviderOSS, "ab", true},
		{"oss with dot", types.ProviderOSS, "my.bucket", true}, // OSS doesn't allow dots
		{"oss starts with hyphen", types.ProviderOSS, "-bucket", true},
		{"oss ends with hyphen", types.ProviderOSS, "bucket-", true},

		// COS tests
		{"cos valid simple", types.ProviderCOS, "mybucket", false},
		{"cos valid with hyphen", types.ProviderCOS, "my-bucket", false},
		{"cos single char", types.ProviderCOS, "a", false}, // COS allows single char
		{"cos starts with hyphen", types.ProviderCOS, "-bucket", true},
		{"cos ends with hyphen", types.ProviderCOS, "bucket-", true},
		{"cos too long", types.ProviderCOS, "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz", true},
		{"cos with dot", types.ProviderCOS, "my.bucket", true}, // COS doesn't allow dots

		// Qiniu tests
		{"qiniu valid simple", types.ProviderQiniu, "my-bucket", false},
		{"qiniu too short", types.ProviderQiniu, "ab", true},
		{"qiniu starts with hyphen", types.ProviderQiniu, "-bucket", true},
		{"qiniu with dot", types.ProviderQiniu, "my.bucket", true},

		// R2 tests
		{"r2 valid simple", types.ProviderR2, "mybucket", false},
		{"r2 valid with hyphen", types.ProviderR2, "my-bucket", false},
		{"r2 too short", types.ProviderR2, "ab", true},
		{"r2 starts with hyphen", types.ProviderR2, "-bucket", true},
		{"r2 ends with hyphen", types.ProviderR2, "bucket-", true},
		{"r2 with dot", types.ProviderR2, "my.bucket", true},

		// MinIO (follows S3 rules)
		{"minio valid", types.ProviderMinIO, "my-bucket", false},
		{"minio with dots", types.ProviderMinIO, "my.bucket.name", false},

		// Custom provider (basic S3 rules)
		{"custom valid", types.ProviderCustom, "my-bucket", false},

		// Edge cases
		{"empty name", types.ProviderAWS, "", true},
		{"whitespace only", types.ProviderAWS, "   ", true},
		{"exact 3 chars", types.ProviderAWS, "abc", false},
		{"exact 63 chars", types.ProviderAWS, "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijk", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBucketName(tt.provider, tt.bucket)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateBucketName(%s, %q) error = %v, wantErr %v", tt.provider, tt.bucket, err, tt.wantErr)
			}
		})
	}
}

func TestValidateAWSBucketName(t *testing.T) {
	// Additional AWS-specific tests
	tests := []struct {
		name    string
		bucket  string
		wantErr bool
	}{
		{"valid bucket with numbers at start", "123bucket", false},
		{"valid bucket numeric only", "12345678901", false},
		{"prohibited prefix amzn-s3-demo-", "amzn-s3-demo-bucket", true},
		{"prohibited suffix --ol-s3", "mybucket--ol-s3", true},
		{"prohibited suffix .mrap", "mybucket.mrap", true},
		{"prohibited suffix --x-s3", "mybucket--x-s3", true},
		{"prohibited suffix --table-s3", "mybucket--table-s3", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAWSBucketName(tt.bucket)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAWSBucketName(%q) error = %v, wantErr %v", tt.bucket, err, tt.wantErr)
			}
		})
	}
}

func TestIsAlphanumericLower(t *testing.T) {
	tests := []struct {
		char byte
		want bool
	}{
		{'a', true},
		{'z', true},
		{'0', true},
		{'9', true},
		{'A', false},
		{'Z', false},
		{'-', false},
		{'.', false},
		{'_', false},
	}

	for _, tt := range tests {
		t.Run(string(tt.char), func(t *testing.T) {
			if got := isAlphanumericLower(tt.char); got != tt.want {
				t.Errorf("isAlphanumericLower(%q) = %v, want %v", tt.char, got, tt.want)
			}
		})
	}
}
