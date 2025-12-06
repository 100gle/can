package providers

import (
	"net/url"
	"strings"
)

// responseHeaderQuery translates common response headers into query parameters supported by providers.
func responseHeaderQuery(headers map[string]string) *url.Values {
	if len(headers) == 0 {
		return nil
	}
	values := url.Values{}
	for key, value := range headers {
		if value == "" {
			continue
		}
		switch strings.ToLower(strings.TrimSpace(key)) {
		case "content-type":
			values.Set("response-content-type", value)
		case "content-disposition":
			values.Set("response-content-disposition", value)
		case "cache-control":
			values.Set("response-cache-control", value)
		case "content-language":
			values.Set("response-content-language", value)
		case "content-encoding":
			values.Set("response-content-encoding", value)
		}
	}
	if len(values) == 0 {
		return nil
	}
	return &values
}
