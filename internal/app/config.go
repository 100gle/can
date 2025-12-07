package app

import "can/internal/config"

// GetBucketVersioning returns versioning status for a bucket.
func (a *App) GetBucketVersioning(accountID, bucket string) (*config.BucketVersioning, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetVersioning(ctx, accountID, bucket)
}

// EnableBucketVersioning enables versioning for a bucket.
func (a *App) EnableBucketVersioning(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.EnableVersioning(ctx, accountID, bucket)
}

// SuspendBucketVersioning suspends versioning for a bucket.
func (a *App) SuspendBucketVersioning(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SuspendVersioning(ctx, accountID, bucket)
}

// GetBucketEncryption fetches the default encryption configuration.
func (a *App) GetBucketEncryption(accountID, bucket string) (*config.BucketEncryption, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetEncryption(ctx, accountID, bucket)
}

// SetBucketEncryption updates default encryption configuration.
func (a *App) SetBucketEncryption(accountID, bucket string, encryption *config.BucketEncryption) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetEncryption(ctx, accountID, bucket, encryption)
}

// DeleteBucketEncryption clears default encryption settings.
func (a *App) DeleteBucketEncryption(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteEncryption(ctx, accountID, bucket)
}

// GetBucketLifecycle lists lifecycle rules.
func (a *App) GetBucketLifecycle(accountID, bucket string) ([]*config.LifecycleRule, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetLifecycle(ctx, accountID, bucket)
}

// SetBucketLifecycle replaces lifecycle rules.
func (a *App) SetBucketLifecycle(accountID, bucket string, rules []*config.LifecycleRule) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetLifecycle(ctx, accountID, bucket, rules)
}

// DeleteBucketLifecycle removes lifecycle rules.
func (a *App) DeleteBucketLifecycle(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteLifecycle(ctx, accountID, bucket)
}

// GetBucketCORS returns CORS rules.
func (a *App) GetBucketCORS(accountID, bucket string) (*config.BucketCORS, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetCORS(ctx, accountID, bucket)
}

// SetBucketCORS upserts CORS rules.
func (a *App) SetBucketCORS(accountID, bucket string, cors *config.BucketCORS) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetCORS(ctx, accountID, bucket, cors)
}

// DeleteBucketCORS removes all CORS rules.
func (a *App) DeleteBucketCORS(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteCORS(ctx, accountID, bucket)
}

// GetBucketWebsite returns static website configuration.
func (a *App) GetBucketWebsite(accountID, bucket string) (*config.BucketWebsite, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetWebsite(ctx, accountID, bucket)
}

// SetBucketWebsite updates static website configuration.
func (a *App) SetBucketWebsite(accountID, bucket string, website *config.BucketWebsite) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetWebsite(ctx, accountID, bucket, website)
}

// DeleteBucketWebsite removes the static website configuration.
func (a *App) DeleteBucketWebsite(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteWebsite(ctx, accountID, bucket)
}

// GetBucketPolicy returns the bucket policy.
func (a *App) GetBucketPolicy(accountID, bucket string) (*config.BucketPolicy, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetPolicy(ctx, accountID, bucket)
}

// SetBucketPolicy upserts the policy document.
func (a *App) SetBucketPolicy(accountID, bucket string, policy *config.BucketPolicy) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetPolicy(ctx, accountID, bucket, policy)
}

// DeleteBucketPolicy removes the policy document.
func (a *App) DeleteBucketPolicy(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeletePolicy(ctx, accountID, bucket)
}

// GetBucketACL returns bucket-level ACL entries.
func (a *App) GetBucketACL(accountID, bucket string) (*config.BucketACL, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetBucketACL(ctx, accountID, bucket)
}

// SetBucketACL updates the bucket ACL definition.
func (a *App) SetBucketACL(accountID, bucket string, acl *config.BucketACL) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetBucketACL(ctx, accountID, bucket, acl)
}

// GetPublicAccessBlock fetches block public access switches.
func (a *App) GetPublicAccessBlock(accountID, bucket string) (*config.PublicAccessBlock, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetPublicAccessBlock(ctx, accountID, bucket)
}

// SetPublicAccessBlock updates the block public access configuration.
func (a *App) SetPublicAccessBlock(accountID, bucket string, block *config.PublicAccessBlock) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetPublicAccessBlock(ctx, accountID, bucket, block)
}

// GetBucketReferer fetches the Referer whitelist configuration.
func (a *App) GetBucketReferer(accountID, bucket string) (*config.BucketReferer, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetBucketReferer(ctx, accountID, bucket)
}

// SetBucketReferer updates the Referer whitelist configuration.
func (a *App) SetBucketReferer(accountID, bucket string, referer *config.BucketReferer) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetBucketReferer(ctx, accountID, bucket, referer)
}
