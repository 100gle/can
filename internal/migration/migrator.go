package migration

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"can/internal/accounts"
	"can/internal/providers"
)

// GenericMigrator implements the Migrator interface for cross-provider transfers.
type GenericMigrator struct {
	accounts *accounts.Service
	pool     providers.ClientPool
}

func NewGenericMigrator(accounts *accounts.Service, pool providers.ClientPool) *GenericMigrator {
	return &GenericMigrator{
		accounts: accounts,
		pool:     pool,
	}
}

func (m *GenericMigrator) Migrate(ctx context.Context, job *MigrationJob, progressCallback func(stats MigrationStats)) error {
	sourceClient, err := m.getClient(ctx, job.Source.AccountID)
	if err != nil {
		return fmt.Errorf("failed to get source client: %w", err)
	}

	destClient, err := m.getClient(ctx, job.Destination.AccountID)
	if err != nil {
		return fmt.Errorf("failed to get destination client: %w", err)
	}

	// 1. Scan source objects
	// For a real generic migrator, we might want to scan & migrate in parallel or chunks.
	// For simplicity, let's scan first or use a producer-consumer model.
	// We'll use a channel to feed objects to workers.

	objectsCh := make(chan providers.ObjectDescriptor, 100)
	errCh := make(chan error, 1)

	// Stats counters (atomic)
	var stats MigrationStats

	// Start workers
	concurrency := job.Options.MaxConcurrency
	if concurrency <= 0 {
		concurrency = 5 // Default
	}

	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			defer wg.Done()
			for obj := range objectsCh {
				if ctx.Err() != nil {
					return
				}

				// Check overwrite
				destKey := job.Destination.Prefix + obj.Key[len(job.Source.Prefix):] // Re-base key
				if !job.Options.Overwrite {
					// Check if exists
					_, err := destClient.Objects().HeadObject(ctx, job.Destination.BucketName, destKey)
					if err == nil {
						// Exists, skip
						atomic.AddInt64(&stats.SkippedObjects, 1)
						atomic.AddInt64(&stats.ProcessedObjects, 1)
						progressCallback(stats)
						continue
					}
					// If err is not NotFound, we might want to log it but proceed?
					// For safety, let's assume if Head fails, we try to write or fail.
					// Ideally we check isNotFoundError(err)
				}

				// Perform Copy
				err := m.copySingleObject(ctx, sourceClient, destClient, job.Source.BucketName, obj.Key, job.Destination.BucketName, destKey)
				if err != nil {
					// Log error? Update job error list?
					atomic.AddInt64(&stats.FailedObjects, 1)
				} else {
					atomic.AddInt64(&stats.CopiedObjects, 1)
					atomic.AddInt64(&stats.ProcessedBytes, obj.Size)
					if job.Options.DeleteSource {
						// Delete source object
						sourceClient.Objects().DeleteObject(ctx, job.Source.BucketName, obj.Key)
					}
				}
				atomic.AddInt64(&stats.ProcessedObjects, 1)
				progressCallback(stats)
			}
		}()
	}

	// Producer: List Objects
	go func() {
		defer close(objectsCh)
		input := providers.ListObjectsInput{
			Bucket: job.Source.BucketName,
			Prefix: job.Source.Prefix,
		}

		for {
			if ctx.Err() != nil {
				return
			}
			result, err := sourceClient.Objects().ListObjects(ctx, input)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
				return
			}

			// Filter out directories if needed, or handle them.
			// providers.ListObjects usually returns contents.
			for _, obj := range result.Objects {
				if obj.IsDir {
					continue
				}
				atomic.AddInt64(&stats.TotalObjects, 1) // Updating total as we find them
				atomic.AddInt64(&stats.TotalBytes, obj.Size)
				progressCallback(stats)

				select {
				case objectsCh <- obj:
				case <-ctx.Done():
					return
				}
			}

			if !result.Truncated {
				break
			}
			input.Marker = result.NextMarker
		}
	}()

	// Wait for workers
	wg.Wait()

	// Check if producer failed
	select {
	case err := <-errCh:
		return err
	default:
	}

	return nil
}

func (m *GenericMigrator) copySingleObject(
	ctx context.Context,
	source providers.StorageClient,
	dest providers.StorageClient,
	srcBucket, srcKey, dstBucket, dstKey string,
) error {
	// Download
	download, err := source.Objects().DownloadObject(ctx, srcBucket, srcKey)
	if err != nil {
		return err
	}
	defer download.Body.Close()

	// Upload
	// We know the size from stats usually, but DownloadObject gives ContentLength
	return dest.Objects().UploadObject(ctx, dstBucket, dstKey, download.Body, download.ContentLength, download.ContentType)
}

func (m *GenericMigrator) getClient(ctx context.Context, accountID string) (providers.StorageClient, error) {
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return m.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, _, err := m.pool.Get(ctx, accountID, supplier)
	return client, err
}
