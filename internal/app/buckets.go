package app

import "can/internal/buckets"

// ListBuckets returns all buckets for the given account.
func (a *App) ListBuckets(accountID string) ([]buckets.BucketInfo, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.ListBuckets(ctx, accountID)
}

// CreateBucket provisions a new bucket under the provided account.
func (a *App) CreateBucket(accountID string, input buckets.CreateBucketInput) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.CreateBucket(ctx, accountID, input)
}

// DeleteBucket removes the selected bucket.
func (a *App) DeleteBucket(accountID, name string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.DeleteBucket(ctx, accountID, name)
}

// BucketLocation resolves the region for a bucket.
func (a *App) BucketLocation(accountID, name string) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.BucketLocation(ctx, accountID, name)
}

// HeadBucket checks whether a bucket exists.
func (a *App) HeadBucket(accountID, name string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.HeadBucket(ctx, accountID, name)
}
