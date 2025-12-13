package cos

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	cosSDK "github.com/tencentyun/cos-go-sdk-v5"

	api "can/internal/storage/api"
)

// NewSDK builds a COS SDK client from generic credentials.
func NewSDK(creds api.ConnectionCredentials) (*cosSDK.Client, error) {
	endpoint := strings.TrimSpace(creds.Endpoint)
	var serviceURL *url.URL
	var err error

	if endpoint != "" {
		serviceURL, err = url.Parse(endpoint)
		if err != nil {
			return nil, fmt.Errorf("invalid COS endpoint: %w", err)
		}
	} else {
		region := strings.TrimSpace(creds.Region)
		if region == "" {
			region = "ap-guangzhou"
		}
		serviceURL, _ = url.Parse(fmt.Sprintf("https://cos.%s.myqcloud.com", region))
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
