package oss

import (
	"context"
)

func (o *objectAdapter) CreateSymlink(ctx context.Context, bucketName, key, target string) error {
	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		return err
	}
	// PutSymlink(symObjectKey string, targetObjectKey string)
	return bucket.PutSymlink(key, target)
}

func (o *objectAdapter) GetSymlink(ctx context.Context, bucketName, key string) (string, error) {
	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		return "", err
	}
	// GetSymlink returns (http.Header, error)
	header, err := bucket.GetSymlink(key)
	if err != nil {
		return "", err
	}
	return header.Get("x-oss-symlink-target"), nil
}
