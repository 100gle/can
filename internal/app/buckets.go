package app

import (
	"can/internal/storage"
	"can/internal/validation"
)

// ListBuckets returns all buckets for the given account.
func (a *App) ListBuckets(accountID string) ([]storage.BucketDescriptor, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.ListBuckets(ctx, accountID)
}

// CreateBucket provisions a new bucket under the provided account.
func (a *App) CreateBucket(accountID string, input storage.BucketCreateInput) error {
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	provider, err := a.accounts.AccountProvider(ctx, accountID)
	if err != nil {
		return err
	}
	if err := storage.ValidateBucketName(provider, input.Name); err != nil {
		return err
	}
	return a.buckets.CreateBucket(ctx, accountID, input)
}

// DeleteBucket removes the selected bucket.
func (a *App) DeleteBucket(accountID, name string) error {
	payload := bucketNameInput{Name: name}
	if err := validation.ValidateStruct(payload); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.DeleteBucket(ctx, accountID, payload.Name)
}

// BucketLocation resolves the region for a bucket.
func (a *App) BucketLocation(accountID, name string) (string, error) {
	payload := bucketNameInput{Name: name}
	if err := validation.ValidateStruct(payload); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.BucketLocation(ctx, accountID, payload.Name)
}

// HeadBucket checks whether a bucket exists.
func (a *App) HeadBucket(accountID, name string) error {
	payload := bucketNameInput{Name: name}
	if err := validation.ValidateStruct(payload); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.HeadBucket(ctx, accountID, payload.Name)
}

type bucketNameInput struct {
	Name string `validate:"required,bucket-name"`
}
