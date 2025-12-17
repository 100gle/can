package storage

import (
	"errors"
	"strings"

	"github.com/qiniu/go-sdk/v7/auth/qbox"
	"github.com/qiniu/go-sdk/v7/storage"
)

type qiniuSDK struct {
	Mac           *qbox.Mac
	BucketManager *storage.BucketManager
	Config        *storage.Config
}

func newQiniuSDK(creds Credentials) (*qiniuSDK, error) {
	accessKey := strings.TrimSpace(creds.AccessKeyID)
	secretKey := strings.TrimSpace(creds.SecretAccessKey)
	if accessKey == "" || secretKey == "" {
		return nil, errors.New("qiniu access key or secret missing")
	}
	mac := qbox.NewMac(accessKey, secretKey)
	cfg := &storage.Config{
		UseHTTPS: creds.UseSSL,
	}
	bucketManager := storage.NewBucketManager(mac, cfg)
	return &qiniuSDK{
		Mac:           mac,
		BucketManager: bucketManager,
		Config:        cfg,
	}, nil
}
