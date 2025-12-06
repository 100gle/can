package objects

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/transfer"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts  *accounts.Service
	pool      providers.ClientPool
	transfers *transfer.Service
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, pool providers.ClientPool, transfers *transfer.Service) *Service {
	return &Service{accounts: accounts, pool: pool, transfers: transfers}
}

// ListObjects returns a single page of objects for the requested prefix.
func (s *Service) ListObjects(ctx context.Context, accountID string, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	payload := providers.ListObjectsInput{
		Bucket:    input.Bucket,
		Prefix:    input.Prefix,
		Delimiter: input.Delimiter,
		Limit:     input.Limit,
		Marker:    input.Marker,
	}
	data, err := client.Objects().ListObjects(ctx, payload)
	if err != nil {
		return result, err
	}
	items := make([]ObjectInfo, 0, len(data.Objects))
	for _, object := range data.Objects {
		items = append(items, toObjectInfo(object))
	}
	result.Objects = items
	result.Truncated = data.Truncated
	result.NextMarker = data.NextMarker
	return result, nil
}

// UploadObject enqueues an upload task handled by the transfer service.
func (s *Service) UploadObject(ctx context.Context, accountID, bucket, key, filePath string) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	return s.transfers.EnqueueUpload(ctx, transfer.UploadRequest{
		AccountID: accountID,
		Bucket:    bucket,
		Key:       key,
		FilePath:  filePath,
	})
}

// DownloadObject enqueues a download task handled by the transfer service.
func (s *Service) DownloadObject(ctx context.Context, accountID, bucket, key, savePath string) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	return s.transfers.EnqueueDownload(ctx, transfer.DownloadRequest{
		AccountID: accountID,
		Bucket:    bucket,
		Key:       key,
		SavePath:  savePath,
	})
}

// DeleteObject removes a single object from the bucket.
func (s *Service) DeleteObject(ctx context.Context, accountID, bucket, key string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("object key is required")
	}
	return client.Objects().DeleteObject(ctx, bucket, key)
}

// CopyObject duplicates an object between buckets/keys.
func (s *Service) CopyObject(ctx context.Context, accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(sourceBucket) == "" || strings.TrimSpace(sourceKey) == "" {
		return errors.New("source bucket/key is required")
	}
	if strings.TrimSpace(targetBucket) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("target bucket/key is required")
	}
	return client.Objects().CopyObject(ctx, sourceBucket, sourceKey, targetBucket, targetKey)
}

// RenameObject renames an object by copying it to the new key and deleting the old key.
func (s *Service) RenameObject(ctx context.Context, accountID, bucket, oldKey, newKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	oldKey = strings.TrimSpace(oldKey)
	if oldKey == "" {
		return errors.New("current object key is required")
	}
	newKey = strings.TrimSpace(newKey)
	if newKey == "" {
		return errors.New("new object key is required")
	}
	if oldKey == newKey {
		return errors.New("new object key must be different from the current key")
	}
	driver := client.Objects()
	if _, err := driver.HeadObject(ctx, bucket, newKey); err == nil {
		return fmt.Errorf("object %q already exists", newKey)
	} else if err != nil && !isNotFoundError(err) {
		return err
	}
	if err := driver.CopyObject(ctx, bucket, oldKey, bucket, newKey); err != nil {
		return err
	}
	if err := driver.DeleteObject(ctx, bucket, oldKey); err != nil {
		return err
	}
	return nil
}

// MoveObjects copies objects to their new destination and deletes the originals.
func (s *Service) MoveObjects(ctx context.Context, accountID string, requests []MoveObjectRequest) (MoveObjectsResult, error) {
	var result MoveObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	driver := client.Objects()
	result.Total = len(requests)
	for _, req := range requests {
		srcBucket := strings.TrimSpace(req.SourceBucket)
		srcKey := strings.TrimSpace(req.SourceKey)
		dstBucket := strings.TrimSpace(req.TargetBucket)
		dstKey := strings.TrimSpace(req.TargetKey)
		if srcBucket == "" || srcKey == "" || dstBucket == "" || dstKey == "" {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  "source/target bucket and key are required",
			})
			continue
		}
		if srcBucket == dstBucket && srcKey == dstKey {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  "target must be different from source",
			})
			continue
		}
		if err := driver.CopyObject(ctx, srcBucket, srcKey, dstBucket, dstKey); err != nil {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  err.Error(),
			})
			continue
		}
		if err := driver.DeleteObject(ctx, srcBucket, srcKey); err != nil {
			cleanupErr := driver.DeleteObject(ctx, dstBucket, dstKey)
			message := fmt.Sprintf("删除源对象失败: %v", err)
			if cleanupErr != nil {
				message = fmt.Sprintf("%s；目标对象已复制但无法回滚：%v", message, cleanupErr)
			} else {
				message = fmt.Sprintf("%s；已回滚目标对象", message)
			}
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  message,
			})
			continue
		}
		result.Succeeded++
	}
	return result, nil
}

// CreateFolder creates a zero-byte object to represent a pseudo-folder.
func (s *Service) CreateFolder(ctx context.Context, accountID, bucket, prefix string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key := strings.TrimSpace(prefix)
	key = strings.Trim(key, " ")
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return errors.New("folder name is required")
	}
	if !strings.HasSuffix(key, "/") {
		key += "/"
	}
	body := bytes.NewReader(nil)
	return client.Objects().UploadObject(ctx, bucket, key, body, 0, "application/x-directory")
}

// HeadObject fetches metadata for a single object.
func (s *Service) HeadObject(ctx context.Context, accountID, bucket, key string) (ObjectInfo, error) {
	var info ObjectInfo
	client, err := s.client(ctx, accountID)
	if err != nil {
		return info, err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return info, errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return info, errors.New("object key is required")
	}
	raw, err := client.Objects().HeadObject(ctx, bucket, key)
	if err != nil {
		return info, err
	}
	info = toObjectInfo(raw)
	return info, nil
}

// GetObjectAttributes gathers metadata, tags and ACL information for the object.
func (s *Service) GetObjectAttributes(ctx context.Context, accountID, bucket, key string) (ObjectAttributes, error) {
	var attrs ObjectAttributes
	client, err := s.client(ctx, accountID)
	if err != nil {
		return attrs, err
	}
	driver := client.Objects()
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return attrs, errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return attrs, errors.New("object key is required")
	}
	desc, err := driver.HeadObject(ctx, bucket, key)
	if err != nil {
		return attrs, err
	}
	attrs.Object = toObjectInfo(desc)
	attrs.Metadata = cloneStringMap(desc.Metadata)
	if tags, err := driver.GetObjectTags(ctx, bucket, key); err == nil {
		attrs.Tags = tags
	} else if err != nil && !errors.Is(err, providers.ErrUnsupportedCapability) {
		return attrs, err
	}
	if acl, err := driver.GetObjectACL(ctx, bucket, key); err == nil {
		attrs.ACL = acl.Canned
		attrs.OwnerID = acl.OwnerID
		attrs.OwnerName = acl.OwnerDisplayName
		attrs.Grants = convertAccessGrants(acl.Grants)
	} else if err != nil && !errors.Is(err, providers.ErrUnsupportedCapability) {
		return attrs, err
	}
	return attrs, nil
}

// UpdateObjectAttributes applies metadata/tag/ACL changes to a single object and returns the updated attributes.
func (s *Service) UpdateObjectAttributes(ctx context.Context, accountID string, patch ObjectAttributesPatch) (ObjectAttributes, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return ObjectAttributes{}, err
	}
	if err := applyObjectPatch(ctx, client.Objects(), patch); err != nil {
		return ObjectAttributes{}, err
	}
	return s.GetObjectAttributes(ctx, accountID, patch.Bucket, patch.Key)
}

// BatchUpdateObjectAttributes best-effort applies patches to multiple objects.
func (s *Service) BatchUpdateObjectAttributes(ctx context.Context, accountID string, patches []ObjectAttributesPatch) (BatchAttributesResult, error) {
	var result BatchAttributesResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	driver := client.Objects()
	result.Total = len(patches)
	for _, patch := range patches {
		if err := applyObjectPatch(ctx, driver, patch); err != nil {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: patch.Bucket,
				Key:    patch.Key,
				Error:  err.Error(),
			})
			continue
		}
		result.Succeeded++
	}
	return result, nil
}

// GetPresignedURL generates a time-bound URL for downloading or uploading objects.
func (s *Service) GetPresignedURL(
	ctx context.Context,
	accountID, bucket, key string,
	expirationSeconds int64,
	method string,
) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("object key is required")
	}
	if expirationSeconds <= 0 {
		expirationSeconds = int64(time.Hour / time.Second)
	}
	maxTTL := int64((7 * 24 * time.Hour) / time.Second)
	if expirationSeconds > maxTTL {
		expirationSeconds = maxTTL
	}
	duration := time.Duration(expirationSeconds) * time.Second
	url, err := client.Objects().PresignURL(ctx, bucket, key, duration, method)
	if err != nil {
		return "", err
	}
	return url, nil
}

// InitiateMultipartUpload starts a multipart upload session.
func (s *Service) InitiateMultipartUpload(ctx context.Context, accountID, bucket, key string) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("object key is required")
	}
	return client.Objects().InitiateMultipartUpload(ctx, bucket, key)
}

// UploadPart uploads a single part for a multipart session.
func (s *Service) UploadPart(
	ctx context.Context,
	accountID, bucket, key, uploadID string,
	partNumber int,
	data []byte,
) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(bucket) == "" {
		return "", errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return "", errors.New("upload id is required")
	}
	if partNumber <= 0 {
		return "", errors.New("part number must be greater than zero")
	}
	if len(data) == 0 {
		return "", errors.New("part payload is empty")
	}
	reader := bytes.NewReader(data)
	return client.Objects().UploadPart(ctx, bucket, key, uploadID, partNumber, reader, int64(len(data)))
}

// CompleteMultipartUpload finalises the multipart upload with the collected ETags.
func (s *Service) CompleteMultipartUpload(
	ctx context.Context,
	accountID, bucket, key, uploadID string,
	parts map[int]string,
) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return errors.New("upload id is required")
	}
	if len(parts) == 0 {
		return errors.New("at least one part is required")
	}
	return client.Objects().CompleteMultipartUpload(ctx, bucket, key, uploadID, parts)
}

// AbortMultipartUpload cancels an in-progress multipart upload.
func (s *Service) AbortMultipartUpload(ctx context.Context, accountID, bucket, key, uploadID string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return errors.New("upload id is required")
	}
	return client.Objects().AbortMultipartUpload(ctx, bucket, key, uploadID)
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, errors.New("account id is required")
	}
	if s.pool == nil {
		return nil, errors.New("storage client pool not configured")
	}
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, _, err := s.pool.Get(ctx, accountID, supplier)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "notfound") ||
		strings.Contains(msg, "not found") ||
		strings.Contains(msg, "not exist") ||
		strings.Contains(msg, "nosuchkey") ||
		strings.Contains(msg, "no such key") ||
		strings.Contains(msg, "nosuchobject") ||
		strings.Contains(msg, "no such object") ||
		strings.Contains(msg, "不存在")
}

func toObjectInfo(desc providers.ObjectDescriptor) ObjectInfo {
	return ObjectInfo{
		Key:          desc.Key,
		Size:         desc.Size,
		LastModified: desc.LastModified,
		ETag:         desc.ETag,
		ContentType:  desc.ContentType,
		StorageClass: desc.StorageClass,
		VersionID:    desc.VersionID,
		IsDir:        desc.IsDir,
	}
}

func cloneStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	clone := make(map[string]string, len(input))
	for k, v := range input {
		clone[k] = v
	}
	return clone
}

func applyObjectPatch(ctx context.Context, driver providers.ObjectDriver, patch ObjectAttributesPatch) error {
	bucket := strings.TrimSpace(patch.Bucket)
	key := strings.TrimSpace(patch.Key)
	if bucket == "" || key == "" {
		return errors.New("bucket and key are required")
	}
	var unsupported []string
	applied := false
	if patch.Metadata != nil || patch.ContentType != "" || patch.StorageClass != "" {
		update := providers.ObjectMetadataUpdate{
			Metadata:     patch.Metadata,
			ContentType:  patch.ContentType,
			StorageClass: patch.StorageClass,
		}
		if err := driver.UpdateObjectMetadata(ctx, bucket, key, update); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "metadata")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if patch.Tags != nil {
		if err := driver.PutObjectTags(ctx, bucket, key, patch.Tags); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "tags")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if acl := strings.TrimSpace(patch.ACL); acl != "" {
		if err := driver.PutObjectACL(ctx, bucket, key, acl); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "acl")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if len(unsupported) > 0 && !applied {
		return fmt.Errorf("当前存储供应商不支持以下操作：%s", strings.Join(unsupported, "、"))
	}
	return nil
}

func appendUnsupported(list []string, feature string) []string {
	for _, existing := range list {
		if existing == feature {
			return list
		}
	}
	return append(list, feature)
}

func convertAccessGrants(grants []providers.AccessGrant) []AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]AccessGrant, 0, len(grants))
	for _, grant := range grants {
		out = append(out, AccessGrant{
			GranteeType: grant.GranteeType,
			Grantee:     grant.Grantee,
			Permission:  grant.Permission,
		})
	}
	return out
}
