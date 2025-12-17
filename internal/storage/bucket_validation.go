package storage

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"can/internal/types"
)

// Bucket name validation errors
var (
	ErrBucketNameEmpty        = errors.New("存储桶名称不能为空")
	ErrBucketNameTooShort     = errors.New("存储桶名称长度至少为3个字符")
	ErrBucketNameTooLong      = errors.New("存储桶名称长度不能超过63个字符")
	ErrBucketNameInvalidChars = errors.New("存储桶名称只能包含小写字母、数字和连字符")
	ErrBucketNameInvalidStart = errors.New("存储桶名称必须以小写字母或数字开头")
	ErrBucketNameInvalidEnd   = errors.New("存储桶名称必须以小写字母或数字结尾")
)

// ValidateBucketName validates bucket name according to provider-specific rules.
func ValidateBucketName(provider types.Provider, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrBucketNameEmpty
	}

	switch provider {
	case types.ProviderAWS:
		return validateAWSBucketName(name)
	case types.ProviderOSS:
		return validateOSSBucketName(name)
	case types.ProviderCOS:
		return validateCOSBucketName(name)
	case types.ProviderQiniu:
		return validateQiniuBucketName(name)
	case types.ProviderR2:
		return validateR2BucketName(name)
	case types.ProviderMinIO:
		return validateAWSBucketName(name) // MinIO follows S3 rules
	default:
		// For custom providers, use basic S3-compatible rules
		return validateBasicBucketName(name)
	}
}

// validateBasicBucketName validates using basic S3-compatible rules.
func validateBasicBucketName(name string) error {
	if len(name) < 3 {
		return ErrBucketNameTooShort
	}
	if len(name) > 63 {
		return ErrBucketNameTooLong
	}
	// Allow lowercase, numbers, dots, and hyphens
	pattern := regexp.MustCompile(`^[a-z0-9][a-z0-9.-]*[a-z0-9]$`)
	if len(name) < 3 || !pattern.MatchString(name) {
		if !isAlphanumericLower(name[0]) {
			return ErrBucketNameInvalidStart
		}
		if !isAlphanumericLower(name[len(name)-1]) {
			return ErrBucketNameInvalidEnd
		}
		return ErrBucketNameInvalidChars
	}
	return nil
}

// validateAWSBucketName validates AWS S3 bucket naming rules.
func validateAWSBucketName(name string) error {
	if len(name) < 3 {
		return ErrBucketNameTooShort
	}
	if len(name) > 63 {
		return ErrBucketNameTooLong
	}

	// Must start and end with letter or number
	if !isAlphanumericLower(name[0]) {
		return ErrBucketNameInvalidStart
	}
	if !isAlphanumericLower(name[len(name)-1]) {
		return ErrBucketNameInvalidEnd
	}

	// Only lowercase letters, numbers, dots, and hyphens
	for _, c := range name {
		if !isAlphanumericLower(byte(c)) && c != '.' && c != '-' {
			return ErrBucketNameInvalidChars
		}
	}

	// Cannot have two adjacent periods
	if strings.Contains(name, "..") {
		return errors.New("存储桶名称不能包含两个相邻的句点")
	}

	// Cannot be formatted as IP address
	ipPattern := regexp.MustCompile(`^\d+\.\d+\.\d+\.\d+$`)
	if ipPattern.MatchString(name) {
		return errors.New("存储桶名称不能采用 IP 地址格式")
	}

	// Prohibited prefixes
	prohibitedPrefixes := []string{"xn--", "sthree-", "amzn-s3-demo-"}
	for _, prefix := range prohibitedPrefixes {
		if strings.HasPrefix(name, prefix) {
			return fmt.Errorf("存储桶名称不能以 %s 开头", prefix)
		}
	}

	// Prohibited suffixes
	prohibitedSuffixes := []string{"-s3alias", "--ol-s3", ".mrap", "--x-s3", "--table-s3"}
	for _, suffix := range prohibitedSuffixes {
		if strings.HasSuffix(name, suffix) {
			return fmt.Errorf("存储桶名称不能以 %s 结尾", suffix)
		}
	}

	return nil
}

// validateOSSBucketName validates Alibaba Cloud OSS bucket naming rules.
func validateOSSBucketName(name string) error {
	if len(name) < 3 {
		return ErrBucketNameTooShort
	}
	if len(name) > 63 {
		return ErrBucketNameTooLong
	}

	// Must start and end with lowercase letter or number
	if !isAlphanumericLower(name[0]) {
		return ErrBucketNameInvalidStart
	}
	if !isAlphanumericLower(name[len(name)-1]) {
		return ErrBucketNameInvalidEnd
	}

	// Only lowercase letters, numbers, and hyphens (no dots)
	for _, c := range name {
		if !isAlphanumericLower(byte(c)) && c != '-' {
			return errors.New("存储桶名称只能包含小写字母、数字和短划线(-)")
		}
	}

	return nil
}

// validateCOSBucketName validates Tencent Cloud COS bucket naming rules.
// Note: AppID is appended separately, this validates the user-provided part.
func validateCOSBucketName(name string) error {
	// COS bucket name max length depends on region and AppID
	// The user-provided part should be reasonable (max ~50 chars to leave room)
	if len(name) < 1 {
		return ErrBucketNameEmpty
	}
	if len(name) > 50 {
		return errors.New("存储桶名称长度不能超过50个字符")
	}

	// Cannot start or end with hyphen
	if name[0] == '-' {
		return errors.New("存储桶名称不能以连字符(-)开头")
	}
	if name[len(name)-1] == '-' {
		return errors.New("存储桶名称不能以连字符(-)结尾")
	}

	// Only lowercase letters, numbers, and hyphens
	for _, c := range name {
		if !isAlphanumericLower(byte(c)) && c != '-' {
			return errors.New("存储桶名称只能包含小写英文字母、数字和中划线(-)")
		}
	}

	return nil
}

// validateQiniuBucketName validates Qiniu Cloud bucket naming rules.
func validateQiniuBucketName(name string) error {
	if len(name) < 3 {
		return ErrBucketNameTooShort
	}
	if len(name) > 63 {
		return ErrBucketNameTooLong
	}

	// Must start and end with lowercase letter or number
	if !isAlphanumericLower(name[0]) {
		return ErrBucketNameInvalidStart
	}
	if !isAlphanumericLower(name[len(name)-1]) {
		return ErrBucketNameInvalidEnd
	}

	// Only lowercase letters, numbers, and hyphens
	for _, c := range name {
		if !isAlphanumericLower(byte(c)) && c != '-' {
			return errors.New("空间名称只能包含小写字母、数字和短划线(-)")
		}
	}

	return nil
}

// validateR2BucketName validates Cloudflare R2 bucket naming rules.
func validateR2BucketName(name string) error {
	if len(name) < 3 {
		return ErrBucketNameTooShort
	}
	if len(name) > 63 {
		return ErrBucketNameTooLong
	}

	// Cannot start or end with hyphen
	if name[0] == '-' {
		return errors.New("存储桶名称不能以连字符(-)开头")
	}
	if name[len(name)-1] == '-' {
		return errors.New("存储桶名称不能以连字符(-)结尾")
	}

	// Only lowercase letters, numbers, and hyphens
	for _, c := range name {
		if !isAlphanumericLower(byte(c)) && c != '-' {
			return errors.New("存储桶名称只能包含小写字母、数字和连字符(-)")
		}
	}

	return nil
}

func isAlphanumericLower(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
}
