package storage

import ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"

// newOSSSDK builds an OSS SDK client from generic credentials.
func newOSSSDK(creds Credentials) (*ossSDK.Client, error) {
	endpoint := creds.OSSEndpoint()
	return ossSDK.New(endpoint, creds.AccessKeyID, creds.SecretAccessKey)
}
