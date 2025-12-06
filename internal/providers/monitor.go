package providers

import (
	"context"
	"io"

	"can/internal/analytics"
)

type MonitoringStorageClient struct {
	StorageClient
	analytics *analytics.Service
}

func NewMonitoringStorageClient(client StorageClient, analytics *analytics.Service) *MonitoringStorageClient {
	return &MonitoringStorageClient{
		StorageClient: client,
		analytics:     analytics,
	}
}

func (c *MonitoringStorageClient) Objects() ObjectDriver {
	return &MonitoringObjectDriver{
		ObjectDriver: c.StorageClient.Objects(),
		analytics:    c.analytics,
		provider:     string(c.StorageClient.Provider()),
	}
}

type MonitoringObjectDriver struct {
	ObjectDriver
	analytics *analytics.Service
	provider  string
}

func (d *MonitoringObjectDriver) UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error {
	err := d.ObjectDriver.UploadObject(ctx, bucket, key, body, size, contentType)
	if err == nil {
		// Log upload traffic
		_ = d.analytics.RecordActivity(ctx, d.provider, size, 0)
	}
	return err
}

func (d *MonitoringObjectDriver) DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error) {
	// We can't easily measure exact bytes read here unless we wrap the ReadCloser.
	// For now, we'll try to get size from HeadObject if we can, or just count the request.
	// Actually, ObjectDownload has ContentLength.
	download, err := d.ObjectDriver.DownloadObject(ctx, input)
	if err == nil {
		// Log download traffic (estimated by content length)
		_ = d.analytics.RecordActivity(ctx, d.provider, 0, download.ContentLength)
	}
	return download, err
}

func (d *MonitoringObjectDriver) ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error) {
	res, err := d.ObjectDriver.ListObjects(ctx, input)
	if err == nil {
		// Count as a request, 0 bytes
		_ = d.analytics.RecordActivity(ctx, d.provider, 0, 0)
	}
	return res, err
}

func (d *MonitoringObjectDriver) DeleteObject(ctx context.Context, bucket, key string) error {
	err := d.ObjectDriver.DeleteObject(ctx, bucket, key)
	if err == nil {
		_ = d.analytics.RecordActivity(ctx, d.provider, 0, 0)
	}
	return err
}

// Wrap other methods to count requests if needed, for now we cover the main transfer ones.
func (d *MonitoringObjectDriver) HeadObject(ctx context.Context, bucket, key string) (ObjectDescriptor, error) {
	res, err := d.ObjectDriver.HeadObject(ctx, bucket, key)
	if err == nil {
		_ = d.analytics.RecordActivity(ctx, d.provider, 0, 0)
	}
	return res, err
}

func (d *MonitoringObjectDriver) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	err := d.ObjectDriver.CopyObject(ctx, sourceBucket, sourceKey, targetBucket, targetKey)
	if err == nil {
		_ = d.analytics.RecordActivity(ctx, d.provider, 0, 0)
	}
	return err
}
