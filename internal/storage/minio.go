package storage

import (
	"errors"
	"fmt"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func newMinioSDK(creds Credentials) (*minio.Client, error) {
	endpoint := strings.TrimSpace(creds.Endpoint)
	if endpoint == "" {
		return nil, errors.New("minio endpoint is required")
	}
	if creds.Port > 0 && !strings.Contains(endpoint, ":") {
		endpoint = fmt.Sprintf("%s:%d", endpoint, creds.Port)
	}
	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(strings.TrimSpace(creds.AccessKeyID), strings.TrimSpace(creds.SecretAccessKey), ""),
		Secure: creds.UseSSL,
		Region: creds.Region,
	}
	return minio.New(endpoint, opts)
}
