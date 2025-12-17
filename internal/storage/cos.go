package storage

import (
	"fmt"
	"net/http"

	cosSDK "github.com/tencentyun/cos-go-sdk-v5"
)

// NewSDK builds a COS SDK client from generic credentials.
func newCOSSDK(creds Credentials) (*cosSDK.Client, error) {
	serviceURL, err := creds.COSEndpoint()
	if err != nil {
		return nil, fmt.Errorf("invalid COS endpoint: %w", err)
	}

	baseURL := &cosSDK.BaseURL{ServiceURL: serviceURL}
	client := cosSDK.NewClient(baseURL, &http.Client{
		Transport: &cosSDK.AuthorizationTransport{
			SecretID:  creds.AccessKeyID,
			SecretKey: creds.SecretAccessKey,
		},
	})
	return client, nil
}
