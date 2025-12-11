package oss

import (
	"context"
	"testing"

	alioss "github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func TestEndpointFromServiceError(t *testing.T) {
	t.Run("with endpoint", func(t *testing.T) {
		err := &alioss.ServiceError{
			Code:     "AccessDenied",
			Endpoint: "oss-cn-hangzhou.aliyuncs.com",
		}
		got := endpointFromServiceError(err, true)
		want := "https://oss-cn-hangzhou.aliyuncs.com"
		if got != want {
			t.Fatalf("expected %s, got %s", want, got)
		}
	})

	t.Run("empty endpoint", func(t *testing.T) {
		err := &alioss.ServiceError{Code: "AccessDenied"}
		if got := endpointFromServiceError(err, true); got != "" {
			t.Fatalf("expected empty endpoint, got %s", got)
		}
	})

	t.Run("value error type", func(t *testing.T) {
		err := alioss.ServiceError{
			Code:     "AccessDenied",
			Endpoint: "oss-cn-beijing.aliyuncs.com",
		}
		got := endpointFromServiceError(err, false)
		want := "http://oss-cn-beijing.aliyuncs.com"
		if got != want {
			t.Fatalf("expected %s, got %s", want, got)
		}
	})
}

func TestEndpointFromRegion(t *testing.T) {
	cases := []struct {
		name     string
		region   string
		useSSL   bool
		expected string
	}{
		{
			name:     "region without oss prefix",
			region:   "cn-beijing",
			useSSL:   true,
			expected: "https://oss-cn-beijing.aliyuncs.com",
		},
		{
			name:     "region already has oss prefix",
			region:   "oss-cn-shanghai",
			useSSL:   false,
			expected: "http://oss-cn-shanghai.aliyuncs.com",
		},
		{
			name:     "already full hostname",
			region:   "oss-cn-hangzhou.aliyuncs.com",
			useSSL:   true,
			expected: "https://oss-cn-hangzhou.aliyuncs.com",
		},
		{
			name:     "empty region",
			region:   "",
			useSSL:   true,
			expected: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := endpointFromRegion(tc.region, tc.useSSL); got != tc.expected {
				t.Fatalf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}

func TestNormalizeEndpoint(t *testing.T) {
	cases := []struct {
		name     string
		endpoint string
		useSSL   bool
		expected string
	}{
		{
			name:     "host without scheme and dot",
			endpoint: "oss-cn-beijing",
			useSSL:   true,
			expected: "https://oss-cn-beijing.aliyuncs.com",
		},
		{
			name:     "host without scheme and already contains dot",
			endpoint: "oss-cn-beijing.aliyuncs.com",
			useSSL:   false,
			expected: "http://oss-cn-beijing.aliyuncs.com",
		},
		{
			name:     "endpoint with scheme",
			endpoint: "http://custom-endpoint.internal",
			useSSL:   true,
			expected: "http://custom-endpoint.internal",
		},
		{
			name:     "empty value",
			endpoint: "",
			useSSL:   true,
			expected: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeEndpoint(tc.endpoint, tc.useSSL); got != tc.expected {
				t.Fatalf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}

func TestIsEndpointMismatchError(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name: "access denied with message",
			err: &alioss.ServiceError{
				Code:    "AccessDenied",
				Message: "This bucket must be addressed using the specified endpoint",
			},
			expected: true,
		},
		{
			name: "access denied with endpoint hint",
			err: &alioss.ServiceError{
				Code:     "AccessDenied",
				Endpoint: "oss-cn-shanghai.aliyuncs.com",
			},
			expected: true,
		},
		{
			name: "different error code",
			err: &alioss.ServiceError{
				Code: "NoSuchBucket",
			},
			expected: false,
		},
		{
			name: "value error type",
			err: alioss.ServiceError{
				Code:     "AccessDenied",
				Endpoint: "oss-cn-shanghai.aliyuncs.com",
			},
			expected: true,
		},
		{
			name:     "non service error",
			err:      context.Canceled,
			expected: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isEndpointMismatchError(tc.err); got != tc.expected {
				t.Fatalf("expected %v, got %v", tc.expected, got)
			}
		})
	}
}

func TestIsAccessDenied(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name: "pointer error",
			err: &alioss.ServiceError{
				Code: "AccessDenied",
			},
			expected: true,
		},
		{
			name: "value error",
			err: alioss.ServiceError{
				Code: "AccessDenied",
			},
			expected: true,
		},
		{
			name:     "other error",
			err:      context.DeadlineExceeded,
			expected: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAccessDenied(tc.err); got != tc.expected {
				t.Fatalf("expected %v, got %v", tc.expected, got)
			}
		})
	}
}
