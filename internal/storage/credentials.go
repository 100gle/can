package storage

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	"can/internal/types"
)

// Credentials holds the authentication and connection parameters for storage providers.
type Credentials struct {
	Provider        types.Provider    `json:"provider"`
	Endpoint        string            `json:"endpoint"`
	AccessKeyID     string            `json:"accessKeyId"`
	SecretAccessKey string            `json:"secretAccessKey"`
	Region          string            `json:"region"`
	Extra           map[string]string `json:"extra"` // Provider-specific params
	UseSSL          bool              `json:"useSSL"`
	Port            int               `json:"port"`
}

// GetExtra returns a specific extra parameter value, or empty string if not found.
func (c Credentials) GetExtra(key string) string {
	if c.Extra == nil {
		return ""
	}
	return c.Extra[key]
}

// GetAppID returns the COS AppID from extra params.
func (c Credentials) GetAppID() string {
	return c.GetExtra("appId")
}

// scheme returns the appropriate URL scheme based on SSL preference.
func (c Credentials) scheme() string {
	if c.UseSSL {
		return "https"
	}
	return "http"
}

// parseOrBuildURL attempts to parse a raw endpoint string. If the string lacks
// a scheme, it builds a url.URL directly using the provided host and SSL preference.
func (c Credentials) parseOrBuildURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	// If already has scheme, parse directly
	if strings.Contains(raw, "://") {
		return url.Parse(raw)
	}
	// Build URL struct directly without string concatenation
	return &url.URL{
		Scheme: c.scheme(),
		Host:   raw,
	}, nil
}

// OSSEndpoint builds the Alibaba OSS endpoint URL.
func (c Credentials) OSSEndpoint() string {
	host := strings.TrimSpace(c.Endpoint)
	if host == "" {
		host = "oss-cn-hangzhou.aliyuncs.com"
	}

	// If already has scheme, parse and return
	if strings.Contains(host, "://") {
		if u, err := url.Parse(host); err == nil {
			return u.String()
		}
	}

	// Build URL using url.URL struct
	u := &url.URL{
		Scheme: c.scheme(),
		Host:   host,
	}
	return u.String()
}

// COSEndpoint builds the Tencent COS service endpoint URL.
func (c Credentials) COSEndpoint() (*url.URL, error) {
	endpoint := strings.TrimSpace(c.Endpoint)
	if endpoint != "" {
		return c.parseOrBuildURL(endpoint)
	}

	region := strings.TrimSpace(c.Region)
	if region == "" {
		region = "ap-guangzhou"
	}

	// Build URL using url.URL struct
	return &url.URL{
		Scheme: "https",
		Host:   fmt.Sprintf("cos.%s.myqcloud.com", region),
	}, nil
}

// S3Endpoint parses and normalizes an S3-compatible endpoint.
// Returns the endpoint string, whether an endpoint was specified, and any error.
func (c Credentials) S3Endpoint() (string, bool, error) {
	raw := strings.TrimSpace(c.Endpoint)
	if raw == "" {
		return "", false, nil
	}

	parsed, err := c.parseOrBuildURL(raw)
	if err != nil {
		return "", false, fmt.Errorf("invalid endpoint: %w", err)
	}
	if parsed == nil {
		return "", false, nil
	}

	// Ensure scheme is set (parseOrBuildURL should handle this, but be defensive)
	if parsed.Scheme == "" {
		parsed.Scheme = c.scheme()
	}

	// Apply port from credentials if not already specified
	if parsed.Port() == "" && c.Port > 0 {
		parsed.Host = net.JoinHostPort(parsed.Hostname(), strconv.Itoa(c.Port))
	}

	// Normalize path: ensure root path, trim trailing slashes
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if parsed.Path == "" {
		parsed.Path = "/"
	}

	return parsed.String(), true, nil
}
