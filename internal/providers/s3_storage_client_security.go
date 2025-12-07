package providers

import (
	"context"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sts"

	"can/internal/types"
)

func (c *s3StorageClient) Security() SecurityDriver {
	if c.provider == types.ProviderAWS {
		return &awsSecurityDriver{creds: c.creds}
	}
	// Future: Add OSS/COS implementation here
	return &UnimplementedSecurityDriver{}
}

type awsSecurityDriver struct {
	creds ConnectionCredentials
}

func (d *awsSecurityDriver) GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error) {
	// 1. Build Config
	cfg, err := d.buildConfig()
	if err != nil {
		return SecurityTokens{}, err
	}

	// 2. Create STS Client
	client := sts.NewFromConfig(cfg)

	// 3. Request Session Token
	input := &sts.GetSessionTokenInput{
		DurationSeconds: aws.Int32(int32(req.DurationSeconds)),
	}

	// Note: AssumeRole is another option if role ARN was provided,
	// but GetSessionToken is standard for temporary access from long-term keys.
	// We might want to support AssumeRole based on input in the future.

	out, err := client.GetSessionToken(ctx, input)
	if err != nil {
		return SecurityTokens{}, WrapS3Error("生成临时凭证", err)
	}

	if out.Credentials == nil {
		return SecurityTokens{}, errors.New("sts returned no credentials")
	}

	return SecurityTokens{
		AccessKeyId:     aws.ToString(out.Credentials.AccessKeyId),
		SecretAccessKey: aws.ToString(out.Credentials.SecretAccessKey),
		SessionToken:    aws.ToString(out.Credentials.SessionToken),
		Expiration:      aws.ToTime(out.Credentials.Expiration),
	}, nil
}

func (d *awsSecurityDriver) buildConfig() (aws.Config, error) {
	// Re-construct basic config from credentials
	// Ideally we should reuse the factory logic, but for now we duplicate minimal config
	accessKey := d.creds.AccessKeyID
	secret := d.creds.SecretAccessKey
	region := d.creds.Region
	if region == "" {
		region = "us-east-1"
	}

	cfg := aws.Config{
		Region:      region,
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secret, "")),
	}
	// We do not set specific endpoint for STS unless necessary (global endpoint usually works)
	// But if d.creds.Endpoint is set (e.g. MinIO), we might need it?
	// MinIO supports STS? Yes.
	// But standard AWS STS endpoint is different from S3.
	// For now, let's assume if it's ProviderAWS, we use standard AWS resolution.
	// If it's custom, we might need custom logic.

	// If provider is NOT AWS (e.g. MinIO), we might need endpoint.
	// But we only return this driver if c.provider == types.ProviderAWS (see above).
	// So standard behavior is fine.

	return cfg, nil
}
