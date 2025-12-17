package storage

import (
	"context"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

type AWSSecurityAPI struct {
	Creds Credentials
}

func newAWSSecurity(creds Credentials) SecurityAdapter {
	return &AWSSecurityAPI{Creds: creds}
}

func (d *AWSSecurityAPI) GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error) {
	cfg, err := d.buildConfig()
	if err != nil {
		return SecurityTokens{}, err
	}

	client := sts.NewFromConfig(cfg)
	input := &sts.GetSessionTokenInput{
		DurationSeconds: aws.Int32(int32(req.DurationSeconds)),
	}

	out, err := client.GetSessionToken(ctx, input)
	if err != nil {
		return SecurityTokens{}, err
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

func (d *AWSSecurityAPI) buildConfig() (aws.Config, error) {
	accessKey := d.Creds.AccessKeyID
	secret := d.Creds.SecretAccessKey
	region := d.Creds.Region
	if region == "" {
		region = "us-east-1"
	}

	cfg := aws.Config{
		Region:      region,
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secret, "")),
	}
	return cfg, nil
}
