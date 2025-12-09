// Package providers contains integration tests for multi-vendor S3 compatibility.
// These tests are designed to run against real cloud services or local emulators
// like MinIO, LocalStack, or MinIO-compatible endpoints.
//
// To run these tests, set the appropriate environment variables:
//
// For MinIO (local testing):
//
//	MINIO_ENDPOINT=localhost:9000
//	MINIO_ACCESS_KEY=minioadmin
//	MINIO_SECRET_KEY=minioadmin
//	MINIO_USE_SSL=false
//
// For AWS S3:
//
//	AWS_ACCESS_KEY_ID=your-key
//	AWS_SECRET_ACCESS_KEY=your-secret
//	AWS_REGION=us-east-1
//
// For testing, use: go test -v -tags=integration ./internal/providers/...
package providers

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"can/internal/types"
)

// TestConfig holds configuration for integration tests.
type TestConfig struct {
	Provider        types.Provider
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	UseSSL          bool
	TestBucket      string
}

// getTestConfigs returns available test configurations from environment.
func getTestConfigs(t *testing.T) []TestConfig {
	t.Helper()
	var configs []TestConfig

	// MinIO configuration
	if endpoint := os.Getenv("MINIO_ENDPOINT"); endpoint != "" {
		configs = append(configs, TestConfig{
			Provider:        types.ProviderCustom,
			Endpoint:        endpoint,
			AccessKeyID:     getEnvOrDefault("MINIO_ACCESS_KEY", "minioadmin"),
			SecretAccessKey: getEnvOrDefault("MINIO_SECRET_KEY", "minioadmin"),
			Region:          getEnvOrDefault("MINIO_REGION", "us-east-1"),
			UseSSL:          os.Getenv("MINIO_USE_SSL") == "true",
			TestBucket:      getEnvOrDefault("MINIO_TEST_BUCKET", "can-integration-test"),
		})
	}

	// AWS S3 configuration
	if keyID := os.Getenv("AWS_ACCESS_KEY_ID"); keyID != "" {
		configs = append(configs, TestConfig{
			Provider:        types.ProviderAWS,
			Endpoint:        "", // Use default AWS endpoint
			AccessKeyID:     keyID,
			SecretAccessKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
			Region:          getEnvOrDefault("AWS_REGION", "us-east-1"),
			UseSSL:          true,
			TestBucket:      getEnvOrDefault("AWS_TEST_BUCKET", "can-integration-test"),
		})
	}

	// Aliyun OSS configuration
	if keyID := os.Getenv("OSS_ACCESS_KEY_ID"); keyID != "" {
		configs = append(configs, TestConfig{
			Provider:        types.ProviderOSS,
			Endpoint:        os.Getenv("OSS_ENDPOINT"),
			AccessKeyID:     keyID,
			SecretAccessKey: os.Getenv("OSS_ACCESS_KEY_SECRET"),
			Region:          os.Getenv("OSS_REGION"),
			UseSSL:          os.Getenv("OSS_USE_SSL") != "false",
			TestBucket:      getEnvOrDefault("OSS_TEST_BUCKET", "can-integration-test"),
		})
	}

	// Tencent COS configuration
	if keyID := os.Getenv("COS_SECRET_ID"); keyID != "" {
		configs = append(configs, TestConfig{
			Provider:        types.ProviderCOS,
			Endpoint:        os.Getenv("COS_ENDPOINT"),
			AccessKeyID:     keyID,
			SecretAccessKey: os.Getenv("COS_SECRET_KEY"),
			Region:          os.Getenv("COS_REGION"),
			UseSSL:          os.Getenv("COS_USE_SSL") != "false",
			TestBucket:      getEnvOrDefault("COS_TEST_BUCKET", "can-integration-test"),
		})
	}

	// R2 configuration
	if keyID := os.Getenv("R2_ACCESS_KEY_ID"); keyID != "" {
		configs = append(configs, TestConfig{
			Provider:        types.ProviderR2,
			Endpoint:        os.Getenv("R2_ENDPOINT"),
			AccessKeyID:     keyID,
			SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
			Region:          "auto",
			UseSSL:          true,
			TestBucket:      getEnvOrDefault("R2_TEST_BUCKET", "can-integration-test"),
		})
	}

	return configs
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestIntegrationListBuckets tests bucket listing across providers.
func TestIntegrationListBuckets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	configs := getTestConfigs(t)
	if len(configs) == 0 {
		t.Skip("no integration test configurations found")
	}

	factory := NewStorageFactory(nil)
	ctx := context.Background()

	for _, cfg := range configs {
		t.Run(string(cfg.Provider), func(t *testing.T) {
			client, err := factory.NewClient(ctx, ConnectionCredentials{
				Provider:        cfg.Provider,
				Endpoint:        cfg.Endpoint,
				AccessKeyID:     cfg.AccessKeyID,
				SecretAccessKey: cfg.SecretAccessKey,
				Region:          cfg.Region,
				UseSSL:          cfg.UseSSL,
			})
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			buckets, err := client.Buckets().ListBuckets(ctx)
			if err != nil {
				t.Fatalf("failed to list buckets: %v", err)
			}

			t.Logf("[%s] Found %d buckets", cfg.Provider, len(buckets))
			for _, bucket := range buckets {
				t.Logf("  - %s (region: %s)", bucket.Name, bucket.Region)
			}
		})
	}
}

// TestIntegrationObjectCRUD tests basic object operations.
func TestIntegrationObjectCRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	configs := getTestConfigs(t)
	if len(configs) == 0 {
		t.Skip("no integration test configurations found")
	}

	factory := NewStorageFactory(nil)
	ctx := context.Background()

	for _, cfg := range configs {
		t.Run(string(cfg.Provider), func(t *testing.T) {
			client, err := factory.NewClient(ctx, ConnectionCredentials{
				Provider:        cfg.Provider,
				Endpoint:        cfg.Endpoint,
				AccessKeyID:     cfg.AccessKeyID,
				SecretAccessKey: cfg.SecretAccessKey,
				Region:          cfg.Region,
				UseSSL:          cfg.UseSSL,
			})
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			objects := client.Objects()
			testKey := fmt.Sprintf("can-test-%d.txt", time.Now().UnixNano())
			testContent := "Hello from CAN integration test"

			// 1. Upload object
			t.Logf("[%s] Uploading object: %s", cfg.Provider, testKey)
			err = objects.UploadObject(ctx, cfg.TestBucket, testKey,
				strings.NewReader(testContent), int64(len(testContent)), "text/plain")
			if err != nil {
				t.Fatalf("upload failed: %v", err)
			}

			// 2. Head object
			t.Logf("[%s] Getting object metadata", cfg.Provider)
			info, err := objects.HeadObject(ctx, cfg.TestBucket, testKey)
			if err != nil {
				t.Fatalf("head object failed: %v", err)
			}
			if info.Size != int64(len(testContent)) {
				t.Errorf("expected size %d, got %d", len(testContent), info.Size)
			}

			// 3. Download object
			t.Logf("[%s] Downloading object", cfg.Provider)
			download, err := objects.DownloadObject(ctx, DownloadObjectInput{
				Bucket: cfg.TestBucket,
				Key:    testKey,
			})
			if err != nil {
				t.Fatalf("download failed: %v", err)
			}
			defer download.Body.Close()

			data, err := io.ReadAll(download.Body)
			if err != nil {
				t.Fatalf("read body failed: %v", err)
			}
			if string(data) != testContent {
				t.Errorf("content mismatch: got %q, want %q", string(data), testContent)
			}

			// 4. List objects
			t.Logf("[%s] Listing objects", cfg.Provider)
			result, err := objects.ListObjects(ctx, ListObjectsInput{
				Bucket: cfg.TestBucket,
				Prefix: "can-test-",
			})
			if err != nil {
				t.Fatalf("list objects failed: %v", err)
			}
			found := false
			for _, obj := range result.Objects {
				if obj.Key == testKey {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("uploaded object not found in list")
			}

			// 5. Delete object
			t.Logf("[%s] Deleting object", cfg.Provider)
			err = objects.DeleteObject(ctx, cfg.TestBucket, testKey)
			if err != nil {
				t.Fatalf("delete failed: %v", err)
			}

			// 6. Verify deletion
			_, err = objects.HeadObject(ctx, cfg.TestBucket, testKey)
			if err == nil {
				t.Errorf("object should be deleted but still exists")
			}

			t.Logf("[%s] CRUD test passed", cfg.Provider)
		})
	}
}

// TestIntegrationBatchDelete tests batch deletion across providers.
func TestIntegrationBatchDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	configs := getTestConfigs(t)
	if len(configs) == 0 {
		t.Skip("no integration test configurations found")
	}

	factory := NewStorageFactory(nil)
	ctx := context.Background()

	for _, cfg := range configs {
		t.Run(string(cfg.Provider), func(t *testing.T) {
			client, err := factory.NewClient(ctx, ConnectionCredentials{
				Provider:        cfg.Provider,
				Endpoint:        cfg.Endpoint,
				AccessKeyID:     cfg.AccessKeyID,
				SecretAccessKey: cfg.SecretAccessKey,
				Region:          cfg.Region,
				UseSSL:          cfg.UseSSL,
			})
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			objects := client.Objects()
			prefix := fmt.Sprintf("can-batch-test-%d", time.Now().UnixNano())
			testKeys := []string{
				prefix + "/file1.txt",
				prefix + "/file2.txt",
				prefix + "/file3.txt",
			}

			// 1. Upload test objects
			t.Logf("[%s] Uploading %d test objects", cfg.Provider, len(testKeys))
			for _, key := range testKeys {
				err = objects.UploadObject(ctx, cfg.TestBucket, key,
					strings.NewReader("test content"), 12, "text/plain")
				if err != nil {
					t.Fatalf("upload %s failed: %v", key, err)
				}
			}

			// 2. Batch delete
			t.Logf("[%s] Batch deleting objects", cfg.Provider)
			result, err := objects.DeleteObjects(ctx, cfg.TestBucket, testKeys)
			if err != nil {
				t.Fatalf("batch delete failed: %v", err)
			}

			t.Logf("[%s] Deleted: %d, Errors: %d", cfg.Provider, len(result.Deleted), len(result.Errors))
			if len(result.Deleted) != len(testKeys) {
				t.Errorf("expected %d deletions, got %d", len(testKeys), len(result.Deleted))
			}
			if len(result.Errors) > 0 {
				for _, e := range result.Errors {
					t.Errorf("delete error for %s: %s", e.Key, e.Message)
				}
			}

			// 3. Verify deletion
			for _, key := range testKeys {
				_, err = objects.HeadObject(ctx, cfg.TestBucket, key)
				if err == nil {
					t.Errorf("object %s should be deleted but still exists", key)
				}
			}

			t.Logf("[%s] Batch delete test passed", cfg.Provider)
		})
	}
}

// TestIntegrationPresignURL tests presigned URL generation.
func TestIntegrationPresignURL(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	configs := getTestConfigs(t)
	if len(configs) == 0 {
		t.Skip("no integration test configurations found")
	}

	factory := NewStorageFactory(nil)
	ctx := context.Background()

	for _, cfg := range configs {
		t.Run(string(cfg.Provider), func(t *testing.T) {
			client, err := factory.NewClient(ctx, ConnectionCredentials{
				Provider:        cfg.Provider,
				Endpoint:        cfg.Endpoint,
				AccessKeyID:     cfg.AccessKeyID,
				SecretAccessKey: cfg.SecretAccessKey,
				Region:          cfg.Region,
				UseSSL:          cfg.UseSSL,
			})
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			objects := client.Objects()
			testKey := fmt.Sprintf("can-presign-test-%d.txt", time.Now().UnixNano())
			testContent := "Presign test content"

			// Upload test object
			err = objects.UploadObject(ctx, cfg.TestBucket, testKey,
				strings.NewReader(testContent), int64(len(testContent)), "text/plain")
			if err != nil {
				t.Fatalf("upload failed: %v", err)
			}
			defer objects.DeleteObject(ctx, cfg.TestBucket, testKey)

			// Generate presigned URL
			url, err := objects.PresignURL(ctx, PresignRequest{
				Bucket:     cfg.TestBucket,
				Key:        testKey,
				Expiration: time.Hour,
				Method:     "GET",
			})
			if err != nil {
				t.Fatalf("presign URL failed: %v", err)
			}

			if url == "" {
				t.Errorf("presigned URL is empty")
			}
			if !strings.HasPrefix(url, "http") {
				t.Errorf("presigned URL should start with http: %s", url)
			}

			t.Logf("[%s] Presigned URL generated: %s...", cfg.Provider, url[:min(80, len(url))])
		})
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
