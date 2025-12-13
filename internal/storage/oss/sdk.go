package oss

import (
	"strings"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"

	api "can/internal/storage/api"
)

// NewSDK builds an OSS SDK client from generic credentials.
func NewSDK(creds api.ConnectionCredentials) (*ossSDK.Client, error) {
	endpoint := resolveEndpoint(creds)
	return ossSDK.New(endpoint, creds.AccessKeyID, creds.SecretAccessKey)
}

func resolveEndpoint(creds api.ConnectionCredentials) string {
	endpoint := strings.TrimSpace(creds.Endpoint)
	if endpoint == "" {
		endpoint = "oss-cn-hangzhou.aliyuncs.com"
	}
	if !strings.Contains(endpoint, "://") {
		protocol := "https"
		if !creds.UseSSL {
			protocol = "http"
		}
		endpoint = protocol + "://" + endpoint
	}
	return endpoint
}
