package storage

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"can/internal/types"
)

// newS3BucketAdapter creates the base S3 bucket adapter.
func newS3BucketAdapter(client S3Client, creds Credentials) BucketAdapter {
	return &s3BucketAdapter{client: client, creds: creds}
}

type s3BucketAdapter struct {
	client S3Client
	creds  Credentials
}

func (d *s3BucketAdapter) ListBuckets(ctx context.Context) ([]BucketDescriptor, error) {
	out, err := d.client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, WrapS3Error("获取 Bucket 列表", err)
	}
	items := make([]BucketDescriptor, 0, len(out.Buckets))
	for _, bucket := range out.Buckets {
		name := aws.ToString(bucket.Name)
		region := d.creds.Region
		if loc, locErr := d.lookupBucketRegion(ctx, name); locErr == nil && loc != "" {
			region = loc
		}
		items = append(items, BucketDescriptor{
			Name:        name,
			CreatedAt:   aws.ToTime(bucket.CreationDate),
			Region:      region,
			ObjectCount: -1,
			Size:        -1,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (d *s3BucketAdapter) CreateBucket(ctx context.Context, input BucketCreateInput) error {
	bucketName := strings.TrimSpace(input.Name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	region := strings.TrimSpace(input.Region)
	if region == "" {
		region = d.creds.Region
	}
	req := &s3.CreateBucketInput{Bucket: aws.String(bucketName)}
	if acl := strings.TrimSpace(input.ACL); acl != "" {
		req.ACL = s3types.BucketCannedACL(acl)
	}
	if shouldIncludeLocationConstraint(d.creds.Provider, region) {
		req.CreateBucketConfiguration = &s3types.CreateBucketConfiguration{
			LocationConstraint: s3types.BucketLocationConstraint(region),
		}
	}

	// Log the actual S3 API call
	log.Info().
		Str("component", "s3.CreateBucket").
		Str("bucket", bucketName).
		Str("region", region).
		Str("acl", input.ACL).
		Bool("hasLocationConstraint", req.CreateBucketConfiguration != nil).
		Msg("Calling S3 CreateBucket API")

	resp, err := d.client.CreateBucket(ctx, req)
	if err != nil {
		log.Error().
			Str("component", "s3.CreateBucket").
			Str("bucket", bucketName).
			Err(err).
			Msg("S3 CreateBucket API failed")
		return WrapS3Error("创建存储桶", err)
	}

	log.Info().
		Str("component", "s3.CreateBucket").
		Str("bucket", bucketName).
		Str("location", aws.ToString(resp.Location)).
		Msg("S3 CreateBucket API succeeded")
	return nil
}

func (d *s3BucketAdapter) DeleteBucket(ctx context.Context, name string) error {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	if _, err := d.client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return WrapS3Error("删除存储桶", err)
	}
	return nil
}

func (d *s3BucketAdapter) HeadBucket(ctx context.Context, name string) error {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	if _, err := d.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return WrapS3Error("检查存储桶", err)
	}
	return nil
}

func (d *s3BucketAdapter) BucketLocation(ctx context.Context, name string) (string, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return "", errors.New("bucket name is required")
	}
	region, err := d.lookupBucketRegion(ctx, bucketName)
	if err != nil {
		return "", WrapS3Error("获取存储桶区域", err)
	}
	return region, nil
}

// encryption
func (d *s3BucketAdapter) GetBucketEncryption(ctx context.Context, bucket string) (*BucketEncryptionConfiguration, error) {
	out, err := d.client.GetBucketEncryption(ctx, &s3.GetBucketEncryptionInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		return nil, WrapS3Error("get bucket encryption", err)
	}
	if out.ServerSideEncryptionConfiguration == nil {
		return nil, nil
	}
	rules := make([]BucketEncryptionRule, len(out.ServerSideEncryptionConfiguration.Rules))
	for i, r := range out.ServerSideEncryptionConfiguration.Rules {
		rules[i] = BucketEncryptionRule{}
		if r.ApplyServerSideEncryptionByDefault != nil {
			rules[i].ApplyServerSideEncryptionByDefault = &ServerSideEncryptionByDefault{
				SSEAlgorithm:   string(r.ApplyServerSideEncryptionByDefault.SSEAlgorithm),
				KMSMasterKeyID: aws.ToString(r.ApplyServerSideEncryptionByDefault.KMSMasterKeyID),
			}
		}
	}
	return &BucketEncryptionConfiguration{Rules: rules}, nil
}

func (d *s3BucketAdapter) PutBucketEncryption(ctx context.Context, bucket string, config BucketEncryptionConfiguration) error {
	rules := make([]s3types.ServerSideEncryptionRule, len(config.Rules))
	for i, r := range config.Rules {
		rules[i] = s3types.ServerSideEncryptionRule{}
		if r.ApplyServerSideEncryptionByDefault != nil {
			rules[i].ApplyServerSideEncryptionByDefault = &s3types.ServerSideEncryptionByDefault{
				SSEAlgorithm:   s3types.ServerSideEncryption(r.ApplyServerSideEncryptionByDefault.SSEAlgorithm),
				KMSMasterKeyID: aws.String(r.ApplyServerSideEncryptionByDefault.KMSMasterKeyID),
			}
		}
	}
	_, err := d.client.PutBucketEncryption(ctx, &s3.PutBucketEncryptionInput{
		Bucket: aws.String(bucket),
		ServerSideEncryptionConfiguration: &s3types.ServerSideEncryptionConfiguration{
			Rules: rules,
		},
	})
	return WrapS3Error("put bucket encryption", err)
}

func (d *s3BucketAdapter) DeleteBucketEncryption(ctx context.Context, bucket string) error {
	_, err := d.client.DeleteBucketEncryption(ctx, &s3.DeleteBucketEncryptionInput{
		Bucket: aws.String(bucket),
	})
	return WrapS3Error("delete bucket encryption", err)
}

// policy
func (d *s3BucketAdapter) GetBucketPolicy(ctx context.Context, bucket string) (string, error) {
	out, err := d.client.GetBucketPolicy(ctx, &s3.GetBucketPolicyInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		return "", WrapS3Error("get bucket policy", err)
	}
	return aws.ToString(out.Policy), nil
}

func (d *s3BucketAdapter) PutBucketPolicy(ctx context.Context, bucket, policy string) error {
	_, err := d.client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
		Bucket: aws.String(bucket),
		Policy: aws.String(policy),
	})
	return WrapS3Error("put bucket policy", err)
}

func (d *s3BucketAdapter) DeleteBucketPolicy(ctx context.Context, bucket string) error {
	_, err := d.client.DeleteBucketPolicy(ctx, &s3.DeleteBucketPolicyInput{
		Bucket: aws.String(bucket),
	})
	return WrapS3Error("delete bucket policy", err)
}

// versioning
func (d *s3BucketAdapter) GetBucketVersioning(ctx context.Context, bucket string) (BucketVersioningStatus, error) {
	out, err := d.client.GetBucketVersioning(ctx, &s3.GetBucketVersioningInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		return "", WrapS3Error("get bucket versioning", err)
	}
	return BucketVersioningStatus(out.Status), nil
}

func (d *s3BucketAdapter) PutBucketVersioning(ctx context.Context, bucket string, status BucketVersioningStatus) error {
	_, err := d.client.PutBucketVersioning(ctx, &s3.PutBucketVersioningInput{
		Bucket: aws.String(bucket),
		VersioningConfiguration: &s3types.VersioningConfiguration{
			Status: s3types.BucketVersioningStatus(status),
		},
	})
	return WrapS3Error("put bucket versioning", err)
}

// lifecycle
func (d *s3BucketAdapter) GetBucketLifecycleConfiguration(ctx context.Context, bucket string) ([]LifecycleRule, error) {
	out, err := d.client.GetBucketLifecycleConfiguration(ctx, &s3.GetBucketLifecycleConfigurationInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		// S3 returns NoSuchLifecycleConfiguration if no rules exist
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && strings.Contains(apiErr.ErrorCode(), "NoSuchLifecycleConfiguration") {
			return []LifecycleRule{}, nil
		}
		return nil, WrapS3Error("get bucket lifecycle", err)
	}
	rules := make([]LifecycleRule, len(out.Rules))
	for i, r := range out.Rules {
		rules[i] = LifecycleRule{
			ID:     aws.ToString(r.ID),
			Prefix: aws.ToString(r.Prefix),
			Status: string(r.Status),
		}
		if r.Expiration != nil {
			rules[i].Expiration = &LifecycleExpiration{
				ExpiredObjectDeleteMarker: aws.ToBool(r.Expiration.ExpiredObjectDeleteMarker),
			}
			if r.Expiration.Days != nil {
				rules[i].Expiration.Days = aws.ToInt32(r.Expiration.Days)
			}
			if r.Expiration.Date != nil {
				rules[i].Expiration.Date = aws.ToTime(r.Expiration.Date)
			}
		}
		if r.NoncurrentVersionExpiration != nil {
			rules[i].NoncurrentVersionExpiration = &NoncurrentVersionExpiration{}
			if r.NoncurrentVersionExpiration.NoncurrentDays != nil {
				rules[i].NoncurrentVersionExpiration.NoncurrentDays = aws.ToInt32(r.NoncurrentVersionExpiration.NoncurrentDays)
			}
		}
		// Incomplete implementation: Transitions, Filter, AbortIncompleteMultipartUpload omitted for brevity matching current needs
	}
	return rules, nil
}

func (d *s3BucketAdapter) PutBucketLifecycleConfiguration(ctx context.Context, bucket string, rules []LifecycleRule) error {
	s3Rules := make([]s3types.LifecycleRule, len(rules))
	for i, r := range rules {
		s3Rules[i] = s3types.LifecycleRule{
			ID:     aws.String(r.ID),
			Prefix: aws.String(r.Prefix),
			Status: s3types.ExpirationStatus(r.Status),
		}
		if r.Expiration != nil {
			s3Rules[i].Expiration = &s3types.LifecycleExpiration{
				ExpiredObjectDeleteMarker: aws.Bool(r.Expiration.ExpiredObjectDeleteMarker),
			}
			if r.Expiration.Days > 0 {
				s3Rules[i].Expiration.Days = aws.Int32(r.Expiration.Days)
			}
			if !r.Expiration.Date.IsZero() {
				s3Rules[i].Expiration.Date = aws.Time(r.Expiration.Date)
			}
		}
		if r.NoncurrentVersionExpiration != nil {
			s3Rules[i].NoncurrentVersionExpiration = &s3types.NoncurrentVersionExpiration{}
			if r.NoncurrentVersionExpiration.NoncurrentDays > 0 {
				s3Rules[i].NoncurrentVersionExpiration.NoncurrentDays = aws.Int32(r.NoncurrentVersionExpiration.NoncurrentDays)
			}
		}
	}
	_, err := d.client.PutBucketLifecycleConfiguration(ctx, &s3.PutBucketLifecycleConfigurationInput{
		Bucket: aws.String(bucket),
		LifecycleConfiguration: &s3types.BucketLifecycleConfiguration{
			Rules: s3Rules,
		},
	})
	return WrapS3Error("put bucket lifecycle", err)
}

func (d *s3BucketAdapter) DeleteBucketLifecycle(ctx context.Context, bucket string) error {
	_, err := d.client.DeleteBucketLifecycle(ctx, &s3.DeleteBucketLifecycleInput{
		Bucket: aws.String(bucket),
	})
	return WrapS3Error("delete bucket lifecycle", err)
}

// cors
func (d *s3BucketAdapter) GetBucketCors(ctx context.Context, bucket string) ([]CORSRule, error) {
	out, err := d.client.GetBucketCors(ctx, &s3.GetBucketCorsInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && strings.Contains(apiErr.ErrorCode(), "NoSuchCORSConfiguration") {
			return []CORSRule{}, nil
		}
		return nil, WrapS3Error("get bucket cors", err)
	}
	rules := make([]CORSRule, len(out.CORSRules))
	for i, r := range out.CORSRules {
		rules[i] = CORSRule{
			ID:             aws.ToString(r.ID),
			AllowedHeaders: r.AllowedHeaders,
			AllowedMethods: r.AllowedMethods,
			AllowedOrigins: r.AllowedOrigins,
			ExposeHeaders:  r.ExposeHeaders,
			MaxAgeSeconds:  aws.ToInt32(r.MaxAgeSeconds),
		}
	}
	return rules, nil
}

func (d *s3BucketAdapter) PutBucketCors(ctx context.Context, bucket string, rules []CORSRule) error {
	s3Rules := make([]s3types.CORSRule, len(rules))
	for i, r := range rules {
		s3Rules[i] = s3types.CORSRule{
			ID:             aws.String(r.ID),
			AllowedHeaders: r.AllowedHeaders,
			AllowedMethods: r.AllowedMethods,
			AllowedOrigins: r.AllowedOrigins,
			ExposeHeaders:  r.ExposeHeaders,
			MaxAgeSeconds:  aws.Int32(r.MaxAgeSeconds),
		}
	}
	_, err := d.client.PutBucketCors(ctx, &s3.PutBucketCorsInput{
		Bucket: aws.String(bucket),
		CORSConfiguration: &s3types.CORSConfiguration{
			CORSRules: s3Rules,
		},
	})
	return WrapS3Error("put bucket cors", err)
}

func (d *s3BucketAdapter) DeleteBucketCors(ctx context.Context, bucket string) error {
	_, err := d.client.DeleteBucketCors(ctx, &s3.DeleteBucketCorsInput{
		Bucket: aws.String(bucket),
	})
	return WrapS3Error("delete bucket cors", err)
}

// website
func (d *s3BucketAdapter) GetBucketWebsite(ctx context.Context, bucket string) (*BucketWebsiteConfiguration, error) {
	out, err := d.client.GetBucketWebsite(ctx, &s3.GetBucketWebsiteInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && strings.Contains(apiErr.ErrorCode(), "NoSuchWebsiteConfiguration") {
			return nil, nil
		}
		return nil, WrapS3Error("get bucket website", err)
	}
	cfg := &BucketWebsiteConfiguration{}
	if out.ErrorDocument != nil {
		cfg.ErrorDocument = &ErrorDocument{Key: aws.ToString(out.ErrorDocument.Key)}
	}
	if out.IndexDocument != nil {
		cfg.IndexDocument = &IndexDocument{Suffix: aws.ToString(out.IndexDocument.Suffix)}
	}
	if out.RedirectAllRequestsTo != nil {
		cfg.RedirectAllRequestsTo = &RedirectAllRequestsTo{
			HostName: aws.ToString(out.RedirectAllRequestsTo.HostName),
			Protocol: string(out.RedirectAllRequestsTo.Protocol),
		}
	}
	return cfg, nil
}

func (d *s3BucketAdapter) PutBucketWebsite(ctx context.Context, bucket string, config BucketWebsiteConfiguration) error {
	input := &s3.PutBucketWebsiteInput{
		Bucket:               aws.String(bucket),
		WebsiteConfiguration: &s3types.WebsiteConfiguration{},
	}
	if config.ErrorDocument != nil {
		input.WebsiteConfiguration.ErrorDocument = &s3types.ErrorDocument{Key: aws.String(config.ErrorDocument.Key)}
	}
	if config.IndexDocument != nil {
		input.WebsiteConfiguration.IndexDocument = &s3types.IndexDocument{Suffix: aws.String(config.IndexDocument.Suffix)}
	}
	if config.RedirectAllRequestsTo != nil {
		input.WebsiteConfiguration.RedirectAllRequestsTo = &s3types.RedirectAllRequestsTo{
			HostName: aws.String(config.RedirectAllRequestsTo.HostName),
			Protocol: s3types.Protocol(config.RedirectAllRequestsTo.Protocol),
		}
	}
	_, err := d.client.PutBucketWebsite(ctx, input)
	return WrapS3Error("put bucket website", err)
}

func (d *s3BucketAdapter) DeleteBucketWebsite(ctx context.Context, bucket string) error {
	_, err := d.client.DeleteBucketWebsite(ctx, &s3.DeleteBucketWebsiteInput{
		Bucket: aws.String(bucket),
	})
	return WrapS3Error("delete bucket website", err)
}

func (d *s3BucketAdapter) GetBucketACL(ctx context.Context, name string) (BucketACL, error) {
	var result BucketACL
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return result, errors.New("bucket name is required")
	}
	out, err := d.client.GetBucketAcl(ctx, &s3.GetBucketAclInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		return result, WrapS3Error("获取 Bucket ACL", err)
	}
	result.OwnerID = aws.ToString(out.Owner.ID)
	result.OwnerDisplayName = aws.ToString(out.Owner.DisplayName)
	result.Grants = convertS3AccessGrants(out.Grants)
	result.Canned = guessS3CannedACL(result.Grants)
	return result, nil
}

func (d *s3BucketAdapter) PutBucketACL(ctx context.Context, name string, acl BucketACLInput) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	if strings.TrimSpace(acl.Canned) != "" && len(acl.Grants) > 0 {
		return errors.New("不能同时设置预设 ACL 与自定义授权")
	}
	input := &s3.PutBucketAclInput{
		Bucket: aws.String(bucket),
	}
	if canned := strings.TrimSpace(acl.Canned); canned != "" {
		input.ACL = s3types.BucketCannedACL(canned)
	} else {
		grants := make([]s3types.Grant, 0, len(acl.Grants))
		for _, grant := range acl.Grants {
			if converted := mapToS3Grant(grant); converted != nil {
				grants = append(grants, *converted)
			}
		}
		if len(grants) == 0 {
			return errors.New("请至少配置一个授权或选择预设 ACL")
		}
		input.AccessControlPolicy = &s3types.AccessControlPolicy{
			Owner: &s3types.Owner{
				ID: aws.String(strings.TrimSpace(acl.OwnerID)),
			},
			Grants: grants,
		}
	}
	if _, err := d.client.PutBucketAcl(ctx, input); err != nil {
		return WrapS3Error("更新 Bucket ACL", err)
	}
	return nil
}

func (d *s3BucketAdapter) GetPublicAccessBlock(ctx context.Context, name string) (PublicAccessBlock, error) {
	var result PublicAccessBlock
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return result, errors.New("bucket name is required")
	}
	out, err := d.client.GetPublicAccessBlock(ctx, &s3.GetPublicAccessBlockInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchPublicAccessBlockConfiguration" {
			return result, nil
		}
		return result, WrapS3Error("获取 Block Public Access", err)
	}
	if out.PublicAccessBlockConfiguration != nil {
		cfg := out.PublicAccessBlockConfiguration
		result.BlockPublicAcls = aws.ToBool(cfg.BlockPublicAcls)
		result.IgnorePublicAcls = aws.ToBool(cfg.IgnorePublicAcls)
		result.BlockPublicPolicy = aws.ToBool(cfg.BlockPublicPolicy)
		result.RestrictPublicBuckets = aws.ToBool(cfg.RestrictPublicBuckets)
	}
	return result, nil
}

func (d *s3BucketAdapter) PutPublicAccessBlock(ctx context.Context, name string, block PublicAccessBlock) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	_, err := d.client.PutPublicAccessBlock(ctx, &s3.PutPublicAccessBlockInput{
		Bucket: aws.String(bucket),
		PublicAccessBlockConfiguration: &s3types.PublicAccessBlockConfiguration{
			BlockPublicAcls:       aws.Bool(block.BlockPublicAcls),
			IgnorePublicAcls:      aws.Bool(block.IgnorePublicAcls),
			BlockPublicPolicy:     aws.Bool(block.BlockPublicPolicy),
			RestrictPublicBuckets: aws.Bool(block.RestrictPublicBuckets),
		},
	})
	if err != nil {
		return WrapS3Error("更新 Block Public Access", err)
	}
	return nil
}

func (d *s3BucketAdapter) GetBucketReferer(ctx context.Context, name string) (BucketReferer, error) {
	return BucketReferer{}, ErrUnsupportedFeature
}

func (d *s3BucketAdapter) PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error {
	return ErrUnsupportedFeature
}

func (d *s3BucketAdapter) GetBucketMAZConfig(ctx context.Context, name string) (*MAZConfiguration, error) {
	return nil, ErrUnsupportedFeature
}

func (d *s3BucketAdapter) EnableBucketMAZ(ctx context.Context, name string) error {
	return ErrUnsupportedFeature
}

func (d *s3BucketAdapter) DisableBucketMAZ(ctx context.Context, name string) error {
	return ErrUnsupportedFeature
}

func (d *s3BucketAdapter) lookupBucketRegion(ctx context.Context, name string) (string, error) {
	out, err := d.client.GetBucketLocation(ctx, &s3.GetBucketLocationInput{Bucket: aws.String(name)})
	if err != nil {
		return "", err
	}
	if out == nil || out.LocationConstraint == "" {
		return "us-east-1", nil
	}
	return string(out.LocationConstraint), nil
}

func convertS3AccessGrants(grants []s3types.Grant) []AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	result := make([]AccessGrant, 0, len(grants))
	for _, grant := range grants {
		if grant.Grantee == nil {
			continue
		}
		entry := AccessGrant{
			Permission: string(grant.Permission),
		}
		switch grant.Grantee.Type {
		case s3types.TypeCanonicalUser:
			entry.GranteeType = "CanonicalUser"
			entry.Grantee = aws.ToString(grant.Grantee.ID)
			entry.DisplayName = aws.ToString(grant.Grantee.DisplayName)
		case s3types.TypeGroup:
			entry.GranteeType = "Group"
			entry.Grantee = aws.ToString(grant.Grantee.URI)
			entry.URI = aws.ToString(grant.Grantee.URI)
		case s3types.TypeAmazonCustomerByEmail:
			entry.GranteeType = "AmazonCustomerByEmail"
			entry.Grantee = aws.ToString(grant.Grantee.EmailAddress)
		default:
			entry.GranteeType = string(grant.Grantee.Type)
			entry.Grantee = aws.ToString(grant.Grantee.ID)
		}
		result = append(result, entry)
	}
	return result
}

func mapToS3Grant(grant AccessGrant) *s3types.Grant {
	permission := strings.ToUpper(strings.TrimSpace(grant.Permission))
	if permission == "" {
		return nil
	}
	perm := s3types.Permission(permission)
	grantee := &s3types.Grantee{}
	switch strings.ToLower(strings.TrimSpace(grant.GranteeType)) {
	case "group":
		grantee.Type = s3types.TypeGroup
		uri := strings.TrimSpace(grant.URI)
		if uri == "" {
			uri = strings.TrimSpace(grant.Grantee)
		}
		if uri == "" {
			return nil
		}
		grantee.URI = aws.String(uri)
	case "canonicaluser", "canonical":
		grantee.Type = s3types.TypeCanonicalUser
		id := strings.TrimSpace(grant.Grantee)
		if id == "" {
			return nil
		}
		grantee.ID = aws.String(id)
		if strings.TrimSpace(grant.DisplayName) != "" {
			grantee.DisplayName = aws.String(strings.TrimSpace(grant.DisplayName))
		}
	case "amazoncustomerbyemail", "email":
		grantee.Type = s3types.TypeAmazonCustomerByEmail
		email := strings.TrimSpace(grant.Grantee)
		if email == "" {
			return nil
		}
		grantee.EmailAddress = aws.String(email)
	default:
		id := strings.TrimSpace(grant.Grantee)
		if id == "" {
			return nil
		}
		grantee.Type = s3types.TypeCanonicalUser
		grantee.ID = aws.String(id)
	}
	return &s3types.Grant{
		Grantee:    grantee,
		Permission: perm,
	}
}

func guessS3CannedACL(grants []AccessGrant) string {
	if len(grants) == 0 {
		return ""
	}
	var hasAllUsersRead, hasAllUsersWrite, hasAllUsersFull bool
	var hasAuthRead bool
	for _, grant := range grants {
		if strings.EqualFold(grant.GranteeType, "Group") {
			switch grant.URI {
			case "http://acs.amazonaws.com/groups/global/AllUsers":
				switch strings.ToUpper(grant.Permission) {
				case "READ":
					hasAllUsersRead = true
				case "WRITE":
					hasAllUsersWrite = true
				case "FULL_CONTROL":
					hasAllUsersFull = true
				}
			case "http://acs.amazonaws.com/groups/global/AuthenticatedUsers":
				if strings.ToUpper(grant.Permission) == "READ" {
					hasAuthRead = true
				}
			}
		}
	}
	switch {
	case hasAllUsersFull || (hasAllUsersRead && hasAllUsersWrite):
		return "public-read-write"
	case hasAllUsersRead:
		return "public-read"
	case hasAuthRead:
		return "authenticated-read"
	default:
		return "private"
	}
}

func shouldIncludeLocationConstraint(provider types.Provider, region string) bool {
	if region == "" {
		return false
	}
	if provider == types.ProviderAWS && strings.EqualFold(region, "us-east-1") {
		return false
	}
	return true
}
